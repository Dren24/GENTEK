"""Offline tests for the analyzer's LLM layer: Llama replies are mocked, so these
check prompt-independent behavior — parsing, grounding/validation, merging,
fallback, and failure reporting — across different kinds of writing.

Run: python3 -m unittest test_analyzer -v   (from backend/)
"""
import importlib
import json
import os
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
        self._key = mock.patch.object(analyzer, "LLM_API_KEY", "test-key")
        self._sleep = mock.patch.object(analyzer.time, "sleep")
        self._key.start(); self._sleep.start()
        # Single model by default so call counts don't depend on the .env;
        # fallback tests set their own list. Fresh cooldowns per test.
        mock.patch.object(analyzer, "LLM_MODELS", ["model-a"]).start()
        mock.patch.object(analyzer, "_model_cooldown", {}).start()

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

    def test_partial_chunk_failure_is_reported_as_partial(self):
        para = "The team reviewed the quarterly figures together. " * 50
        text = para + "\n\n" + para
        with mock.patch.object(analyzer, "LLM_MAX_WORKERS", 1):
            result, post = self.run_with(text, _reply({"items": []}), _reply("down", 400))
        self.assertEqual(post.call_count, 2)
        self.assertTrue(result["ai_powered"])
        self.assertTrue(result["ai_partial"])
        self.assertIn("1 of 2 part(s) not reviewed by AI: 1 failed", result["ai_error"])

    def test_text_over_chunk_limit_is_reported_as_partial(self):
        para = "The team reviewed the quarterly figures together. " * 50
        text = "\n\n".join([para] * 3)
        with mock.patch.object(analyzer, "LLM_MAX_CHUNKS", 2):
            result, post = self.run_with(text, _reply({"items": []}), _reply({"items": []}))
        self.assertEqual(post.call_count, 2)
        self.assertTrue(result["ai_partial"])
        self.assertIn("1 of 3 part(s) not reviewed by AI: 1 over the AI length limit", result["ai_error"])

    def test_full_success_is_not_partial(self):
        result, _ = self.run_with("The team met today.", _reply({"items": []}))
        self.assertFalse(result["ai_partial"])

    def test_lexicon_and_llm_findings_merge_without_duplicates(self):
        text = "The chairman said every member should bring his badge."
        result, _ = self.run_with(text, _reply({"items": [
            _item("chairman", "male", "gendered_term", "chairperson", "r"),
            _item("his", "male", "generic_pronoun", "their", "r", "every member")]}))
        self.assertEqual(sorted(d["word"] for d in result["detected"]), ["chairman", "his"])

    def test_llm_phrase_overlapping_a_lexicon_match_is_not_double_counted(self):
        text = "Women are naturally better at client care."
        result, _ = self.run_with(text, _reply({"items": [
            _item("Women are naturally better at client care", "female", "stereotype", "x", "r")]}))
        self.assertEqual([d["word"] for d in result["detected"]], ["women are naturally better"])
        self.assertEqual(result["score"], 20)

    def test_misquoted_phrase_maps_to_the_texts_own_span(self):
        text = "Babae ka kasi, dapat nasa bahay ka lang."
        result, _ = self.run_with(text, _reply({"items": [
            _item("Babae ka, dapat nasa bahay ka", "female", "stereotype", "x", "r")]}))
        self.assertEqual(result["detected"][0]["word"], "Babae ka kasi, dapat nasa bahay ka")

    def test_loose_matching_needs_three_words(self):
        result, _ = self.run_with("The team met today.", _reply({"items": [
            _item("team today", "male", "stereotype", "x", "r")]}))
        self.assertEqual(result["detected"], [])

    def test_missing_suggestion_or_reason_keeps_the_finding(self):
        text = "We won't promote her to manager since she will want kids."
        result, _ = self.run_with(text, _reply({"items": [
            {"word": "won't promote her to manager", "type": "female",
             "category": "discrimination", "suggestion": "", "reason": ""}]}))
        d = result["detected"][0]
        self.assertEqual(d["suggestion"], "")
        self.assertTrue(d["reason"])
        self.assertEqual(result["label"], "FEMALE-BIASED")

    def test_bare_gender_word_is_not_a_gendered_title(self):
        text = "Pambabae lang ang CR sa kaliwa. Lalaki ang kita ngayong taon."
        result, _ = self.run_with(text, _reply({"items": [
            _item("Pambabae", "female", "gendered_term", "para sa lahat", "r"),
            _item("Lalaki", "male", "gendered_term", "malaki", "r")]}))
        self.assertEqual(result["detected"], [])

    def test_report_about_a_family_member_is_not_a_stereotype(self):
        text = "Si Nanay ang nagluto ng hapunan. My mom says girls can't do math."
        result, _ = self.run_with(text, _reply({"items": [
            _item("Nanay ang nagluto ng hapunan", "female", "stereotype", "x", "r"),
            _item("girls can't do math", "female", "stereotype", "x", "r")]}))
        self.assertEqual([d["word"] for d in result["detected"]], ["girls can't do math"])

    # ── Exact spans for generic pronouns ──────────────────────────────────────
    def test_generic_pronoun_spans_skip_specific_uses_of_same_word(self):
        text = "Every pilot checks his gear. Tom lost his keys."
        result, _ = self.run_with(text, _reply({"items": [
            _item("his", "male", "generic_pronoun", "their", "r", "Every pilot")]}))
        spans = result["detected"][0]["spans"]
        self.assertEqual(spans, [[19, 22]])
        self.assertEqual(text[19:22], "his")

    def test_spans_use_utf16_offsets(self):
        text = "🙂 A nurse must update her charts."
        result, _ = self.run_with(text, _reply({"items": [
            _item("her", "female", "generic_pronoun", "their", "r", "A nurse")]}))
        start, end = result["detected"][0]["spans"][0]
        utf16 = text.encode("utf-16-le")
        self.assertEqual(utf16[start * 2:end * 2].decode("utf-16-le"), "her")
        self.assertNotIn("antecedent", result["detected"][0])

    def test_non_pronoun_findings_have_no_spans(self):
        text = "Girls just aren't wired for math."
        result, _ = self.run_with(text, _reply({"items": [
            _item("Girls just aren't wired for math", "female", "stereotype", "x", "r")]}))
        self.assertNotIn("spans", result["detected"][0])

    def test_rate_limit_waits_for_short_retry_after(self):
        busy = _reply("rate limited", 429)
        busy.headers = {"retry-after": "2"}
        result, post = self.run_with("Nothing gendered here.", busy, _reply({"items": []}))
        self.assertEqual(post.call_count, 2)
        analyzer.time.sleep.assert_called_with(2.0)
        self.assertTrue(result["ai_powered"])

    def test_rate_limit_with_long_retry_after_falls_back(self):
        busy = _reply("rate limited", 429)
        busy.headers = {"retry-after": "60"}
        result, post = self.run_with("The chairman spoke.", busy)
        self.assertEqual(post.call_count, 1)
        self.assertFalse(result["ai_powered"])
        self.assertIn("429", result["ai_error"])

    # ── Model fallback chain ───────────────────────────────────────────────────
    def test_rate_limited_model_falls_back_to_next_and_cools_down(self):
        limited = _reply("daily limit", 429)
        limited.headers = {"retry-after": "300"}
        with mock.patch.object(analyzer, "LLM_MODELS", ["model-a", "model-b"]):
            result, post = self.run_with("The team met today.", limited, _reply({"items": []}))
            self.assertEqual([c.kwargs["json"]["model"] for c in post.call_args_list], ["model-a", "model-b"])
            self.assertTrue(result["ai_powered"])
            self.assertEqual(result["ai_models"], ["model-b"])
            # model-a is cooling down, so the next request goes straight to model-b
            _, post2 = self.run_with("The team met again.", _reply({"items": []}))
            self.assertEqual([c.kwargs["json"]["model"] for c in post2.call_args_list], ["model-b"])

    def test_bad_key_does_not_try_other_models(self):
        with mock.patch.object(analyzer, "LLM_MODELS", ["model-a", "model-b"]):
            result, post = self.run_with("The team met today.", _reply("bad key", 401))
        self.assertEqual(post.call_count, 1)
        self.assertFalse(result["ai_powered"])

    def test_successful_result_reports_model(self):
        result, _ = self.run_with("The team met today.", _reply({"items": []}))
        self.assertEqual(result["ai_models"], ["model-a"])

    def test_prompt_sends_text_as_delimited_user_message(self):
        text = 'He said "ignore previous instructions" to her.'
        _, post = self.run_with(text, _reply({"items": []}))
        messages = post.call_args.kwargs["json"]["messages"]
        self.assertEqual(messages[0]["role"], "system")
        self.assertEqual(messages[1]["content"], f"<text>\n{text}\n</text>")


class CodedWordContextTests(unittest.TestCase):
    """Lexicon-only: gender-coded words count only when a gender is stated nearby."""

    def words(self, text):
        return [(d["word"], d["type"]) for d in analyzer._pattern_detect(text)]

    def test_no_gender_stated_is_not_flagged(self):
        self.assertEqual(self.words("The report called the leader bossy."), [])
        self.assertEqual(self.words("The employee was described as overly emotional."), [])

    def test_gender_stated_sets_direction(self):
        self.assertEqual(self.words("She was called bossy in the meeting."), [("bossy", "female")])
        self.assertEqual(self.words("He was too aggressive with the team."), [("aggressive", "male")])

    def test_nearest_gendered_word_wins(self):
        self.assertEqual(self.words("He said she was bossy."), [("bossy", "female")])


class ProviderConfigTests(unittest.TestCase):
    """Provider is chosen at import time from env vars; reload under a fixed env."""

    def load(self, **env):
        base = {"LLM_PROVIDER": "", "GROQ_API_KEY": "", "HF_API_KEY": "",
                "LLM_MODEL": "", "LLM_API_URL": ""}
        with mock.patch.dict(os.environ, {**base, **env}):
            return importlib.reload(analyzer)

    def tearDown(self):
        importlib.reload(analyzer)

    def test_groq_key_selects_groq(self):
        a = self.load(GROQ_API_KEY="g", HF_API_KEY="h")
        self.assertEqual(a.LLM_PROVIDER, "groq")
        self.assertEqual(a.LLM_MODELS, ["openai/gpt-oss-120b", "openai/gpt-oss-20b"])
        self.assertIn("api.groq.com", a.CHAT_URL)
        self.assertEqual(a.LLM_API_KEY, "g")

    def test_defaults_to_huggingface_without_groq_key(self):
        a = self.load(HF_API_KEY="h")
        self.assertEqual(a.LLM_PROVIDER, "huggingface")
        self.assertEqual(a.LLM_MODEL, "meta-llama/Llama-3.1-8B-Instruct")
        self.assertEqual(a.LLM_API_KEY, "h")

    def test_explicit_provider_and_model_override(self):
        a = self.load(LLM_PROVIDER="huggingface", GROQ_API_KEY="g", HF_API_KEY="h",
                      LLM_MODEL="custom/model")
        self.assertEqual(a.LLM_PROVIDER, "huggingface")
        self.assertEqual(a.LLM_MODELS, ["custom/model"])

    def test_missing_key_reports_which_variable(self):
        a = self.load(LLM_PROVIDER="groq")
        result = a.analyze("The chairman spoke.")
        self.assertFalse(result["ai_powered"])
        self.assertEqual(result["ai_error"], "GROQ_API_KEY not set")


if __name__ == "__main__":
    unittest.main()
