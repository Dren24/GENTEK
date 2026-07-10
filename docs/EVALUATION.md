# GENTEK Manual Accuracy Evaluation

This evaluation supports Option A from the methodology discussion: a real test
set was manually prepared, run through the implemented analyzer, and scored
against expected labels and expected detected terms.

## Dataset

- Source: manually written by the developer for system validation.
- Size: 80 English sentences.
- Training samples: 0. The system was not trained on these cases.
- Purpose: testing only.
- Labels: `MALE-BIASED`, `FEMALE-BIASED`, `MIXED-BIAS`, and `GENDER-NEUTRAL`.
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

To include Hugging Face LLM calls when `HF_API_KEY` is configured:

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
