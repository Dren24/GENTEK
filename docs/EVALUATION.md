# GENTEK Manual Accuracy Evaluation

This evaluation supports Option A from the methodology discussion: a real test
set was manually prepared, run through the implemented analyzer, and scored
against expected labels and expected detected terms.

## Dataset

- Source: manually written by the developer for system validation.
- Size: 80 English sentences.
- Training samples: 0. The system was not trained on these cases.
- Purpose: testing only.
- Labels: `MALE-BIASED`, `FEMALE-BIASED`, and `GENDER-NEUTRAL` (`MIXED-BIAS` is retired).
- Test file: `docs/gentek_evaluation_cases.csv`.

## Method

Each row contains:

- `text`: the sentence submitted to GENTEK.
- `expected_label`: the correct output label.
- `expected_terms`: the biased terms expected to be detected.
- `notes`: the reason the sentence was included.

The evaluation script compares the analyzer output against the expected label
and expected term set.

## Run

For the reproducible lexicon validation:

```bash
python3 backend/evaluate_accuracy.py
```

To show any failing cases:

```bash
python3 backend/evaluate_accuracy.py --show-errors
```

To include LLM calls when `HF_API_KEY` (Llama 3.1 8B on Hugging Face, tried first) and/or `GROQ_API_KEY` (gpt-oss backup on Groq) is configured. The output's "LLM enabled" line lists the model chain; results reflect Llama 3.1 only when Hugging Face answered:

```bash
python3 backend/evaluate_accuracy.py --use-llm --show-errors
```

## Metrics Reported

- Label accuracy
- Exact detected-term accuracy
- Detected-term precision
- Detected-term recall
- Detected-term F1 score

The default run disables the LLM for reproducibility and evaluates the
rule-based lexicon detector directly.

## Limitation

This is a manually prepared validation set designed to test known system
requirements and lexicon coverage. It is not a randomized public benchmark and
should not be described as training data.

Known AI-layer limitations observed during live testing:

- Tagalog "lalaki" means both "man/male" and "will grow". The AI can misread
  the "will grow" sense (e.g. "Lalaki rin ang negosyo mo") as a gender
  reference. No reliable rule separates the two, since "Lalaki ang anak niya"
  ("her child is a boy") is a genuine gender reference.
- Tagalog and Bisaya are handled by the AI; the lexicon covers only a small set
  of stock phrases in those languages. Other Philippine languages are untested.
- GENTEK tries Llama 3.1 8B on Hugging Face first, then Groq's gpt-oss models.
  A provider out of credits or with a bad key is skipped for 10 minutes; a
  rate-limited model is skipped until its limit resets (Groq's free tier caps
  tokens per model per day). When every model is unavailable, analysis is
  keyword-only and the UI says so.
