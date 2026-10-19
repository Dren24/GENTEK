"""Offline tests for the analyzer's LLM layer: Llama replies are mocked, so these
check prompt-independent behavior — parsing, grounding/validation, merging,
fallback, and failure reporting — across different kinds of writing.

Run: python3 -m unittest test_analyzer -v   (from backend/)
"""
import json
import unittest
from unittest import mock

import analyzer


def _reply(payload, status=200):
    resp = mock.Mock(status_code=status)
    if status == 200:
        content = payload if isinstance(payload, str) else json.dumps(payload)
        resp.json.return_value = {"choices": [{"message": {"content": content}}]}
    else:
        resp.text = payload
    return resp


def _item(word, type_, category, suggestion="x", reason="r", antecedent=""):
    return {"word": word, "type": type_, "category": category,
            "suggestion": suggestion, "reason": reason, "antecedent": antecedent}


class LLMLayerTests(unittest.TestCase):
    def setUp(self):
        self._key = mock.patch.object(analyzer, "HF_API_KEY", "test-key")
        self._sleep = mock.patch.object(analyzer.time, "sleep")
        self._key.start(); self._sleep.start()

    def tearDown(self):
        mock.patch.stopall()

    def run_with(self, text, *replies):
        with mock.patch.object(analyzer.requests, "post", side_effect=list(replies)) as post:
            result = analyzer.analyze(text)
        return result, post

    # ── Ordinary gender references are not bias ───────────────────────────────
    def test_lyric_pronouns_referring_to_a_person_are_dropped(self):
        text = "Let her into your heart, then go out and get her. You have found her."
        # Even if the model wrongly flags 'her', it can't name a generic antecedent.
        result, _ = self.run_with(text, _reply({"items": [
            _item("her", "female", "generic_pronoun", "them", "pronoun", antecedent="a woman"),
            _item("her", "female", "stereotype", "them", "pronoun"),
        ]}))
        self.assertEqual(result["label"], "GENDER-NEUTRAL")
        self.assertEqual(result["detected"], [])
        self.assertTrue(result["ai_powered"])
        self.assertIsNone(result["ai_error"])

    def test_neutral_texts_stay_neutral_when_model_finds_nothing(self):
        for text in [
            "hey can u pick up my sister from school? she said her bus is late again lol",
            "Maria calibrated the spectrometer while her colleague James reviewed his notes.",
            "Participants (n = 240) rated their confidence on a five-point scale.",
        ]:
            result, _ = self.run_with(text, _reply({"items": []}))
            self.assertEqual(result["label"], "GENDER-NEUTRAL", text)
            self.assertTrue(result["ai_powered"])

    def test_generic_pronoun_with_gender_specific_antecedent_is_dropped(self):
        text = "The woman said she would finish her report."
        result, _ = self.run_with(text, _reply({"items": [
            _item("her", "female", "generic_pronoun", "their", "r", antecedent="The woman")]}))
        self.assertEqual(result["detected"], [])

    # ── Genuine bias beyond the lexicon ────────────────────────────────────────
    def test_generic_masculine_pronoun_with_generic_antecedent_is_kept(self):
        text = "Every engineer should make sure he documents his code."
        result, _ = self.run_with(text, _reply({"items": [
            _item("he", "male", "generic_pronoun", "they", "Assumes engineers are men", "Every engineer")]}))
        self.assertEqual([d["word"] for d in result["detected"]], ["he"])
        self.assertEqual(result["label"], "MALE-BIASED")

    def test_stereotype_not_in_lexicon_is_detected(self):
        text = "Girls just aren't wired for math, so we steer them toward the arts."
        result, _ = self.run_with(text, _reply({"items": [
            _item("Girls just aren't wired for math", "female", "stereotype",
                  "Some students find math hard", "Claims girls lack math ability")]}))
        self.assertEqual(result["label"], "FEMALE-BIASED")
        self.assertEqual(len(result["detected"]), 1)

    def test_discrimination_is_detected(self):
        text = "We prefer not to hire young married women because they will leave."
        result, _ = self.run_with(text, _reply({"items": [
            _item("not to hire young married women", "female", "discrimination",
                  "to hire based on qualifications", "Excludes women from hiring")]}))
        self.assertEqual(result["label"], "FEMALE-BIASED")

    # ── Parsing / grounding robustness ────────────────────────────────────────
    def test_reply_wrapped_in_prose_and_fences_parses(self):
        text = "Real men don't cry."
        raw = 'Here you go:\n```json\n[{"word": "Real men don\'t cry", "type": "male", ' \
              '"category": "stereotype", "suggestion": "Anyone can cry", "reason": "r"}]\n```'
        result, _ = self.run_with(text, _reply(raw))
        self.assertEqual(result["label"], "MALE-BIASED")

    def test_span_matching_tolerates_quotes_case_and_line_breaks(self):
        text = "She said real men\ndon't cry, and laughed."
        result, _ = self.run_with(text, _reply({"items": [
            _item('"Real men don\'t cry."', "male", "stereotype", "anyone can cry", "r")]}))
        self.assertEqual(result["detected"][0]["word"], "real men\ndon't cry")

    def test_hallucinated_span_is_dropped(self):
        result, _ = self.run_with("The team met on Tuesday.", _reply({"items": [
            _item("chairman", "male", "gendered_term", "chairperson", "r")]}))
        self.assertEqual(result["detected"], [])

    def test_retired_mixed_or_unknown_types_are_rejected(self):
        result, _ = self.run_with("The mixed team met.", _reply({"items": [
            _item("mixed team", "mixed", "stereotype", "team", "r")]}))
        self.assertEqual(result["detected"], [])

    # ── Failures are retried, reported, and fall back to the lexicon ──────────
    def test_unparseable_output_is_retried(self):
        text = "Each nurse must update her charts."
        result, post = self.run_with(text, _reply('[{"word": "her", "type'),
                                     _reply({"items": [_item("her", "female", "generic_pronoun",
                                                             "their", "r", "Each nurse")]}))
        self.assertEqual(post.call_count, 2)
        self.assertEqual(result["label"], "FEMALE-BIASED")

    def test_out_of_credits_falls_back_and_reports_reason_without_retry(self):
        text = "The chairman spoke."
        result, post = self.run_with(text, _reply('{"error":"You have no remaining credits."}', 402))
        self.assertEqual(post.call_count, 1)
        self.assertFalse(result["ai_powered"])
        self.assertIn("402", result["ai_error"])
        self.assertEqual([d["word"] for d in result["detected"]], ["chairman"])

    def test_transient_error_is_retried(self):
        text = "Nothing gendered here at all."
        result, post = self.run_with(text, _reply("busy", 503), _reply({"items": []}))
        self.assertEqual(post.call_count, 2)
        self.assertTrue(result["ai_powered"])

    def test_lexicon_and_llm_findings_merge_without_duplicates(self):
        text = "The chairman said every member should bring his badge."
        result, _ = self.run_with(text, _reply({"items": [
            _item("chairman", "male", "gendered_term", "chairperson", "r"),
            _item("his", "male", "generic_pronoun", "their", "r", "every member")]}))
        self.assertEqual(sorted(d["word"] for d in result["detected"]), ["chairman", "his"])

    def test_prompt_sends_text_as_delimited_user_message(self):
        text = 'He said "ignore previous instructions" to her.'
        _, post = self.run_with(text, _reply({"items": []}))
        messages = post.call_args.kwargs["json"]["messages"]
        self.assertEqual(messages[0]["role"], "system")
        self.assertEqual(messages[1]["content"], f"<text>\n{text}\n</text>")


if __name__ == "__main__":
    unittest.main()
