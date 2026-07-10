"""Evaluate GENTEK against manually prepared test cases.

This script is intentionally small and dependency-free so the evaluation can be
reproduced during defense or documentation work.
"""

from __future__ import annotations

import argparse
import csv
import os
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CASES = ROOT / "docs" / "gentek_evaluation_cases.csv"


def parse_terms(value: str) -> set[str]:
    if not value.strip():
        return set()
    return {part.strip().lower() for part in value.split("|") if part.strip()}


def load_cases(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the GENTEK accuracy evaluation set.")
    parser.add_argument("--cases", type=Path, default=DEFAULT_CASES, help="CSV file of evaluation cases")
    parser.add_argument("--use-llm", action="store_true", help="Include HuggingFace LLM calls if HF_API_KEY is configured")
    parser.add_argument("--show-errors", action="store_true", help="Print every failed case")
    args = parser.parse_args()

    if not args.use_llm:
        os.environ["HF_API_KEY"] = ""

    sys.path.insert(0, str(ROOT / "backend"))
    import analyzer  # noqa: PLC0415

    if not args.use_llm:
        analyzer.HF_API_KEY = ""

    cases = load_cases(args.cases)
    label_correct = 0
    exact_terms_correct = 0
    expected_term_total = 0
    actual_term_total = 0
    true_positive_terms = 0
    errors = []

    for row in cases:
        result = analyzer.analyze(row["text"])
        expected_label = row["expected_label"]
        actual_label = result["label"]
        expected_terms = parse_terms(row["expected_terms"])
        actual_terms = {item["word"].strip().lower() for item in result["detected"]}

        label_ok = actual_label == expected_label
        terms_ok = actual_terms == expected_terms
        label_correct += int(label_ok)
        exact_terms_correct += int(terms_ok)
        expected_term_total += len(expected_terms)
        actual_term_total += len(actual_terms)
        true_positive_terms += len(expected_terms & actual_terms)

        if not (label_ok and terms_ok):
            errors.append({
                "id": row["id"],
                "expected_label": expected_label,
                "actual_label": actual_label,
                "expected_terms": sorted(expected_terms),
                "actual_terms": sorted(actual_terms),
            })

    total = len(cases)
    label_accuracy = label_correct / total if total else 0
    exact_detection_accuracy = exact_terms_correct / total if total else 0
    precision = true_positive_terms / actual_term_total if actual_term_total else 1
    recall = true_positive_terms / expected_term_total if expected_term_total else 1
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0

    print("GENTEK Manual Evaluation")
    print(f"Cases: {total}")
    print(f"LLM enabled: {'yes' if args.use_llm else 'no'}")
    print(f"Label accuracy: {label_correct}/{total} = {label_accuracy:.2%}")
    print(f"Exact detected-term accuracy: {exact_terms_correct}/{total} = {exact_detection_accuracy:.2%}")
    print(f"Detected-term precision: {precision:.2%}")
    print(f"Detected-term recall: {recall:.2%}")
    print(f"Detected-term F1: {f1:.2%}")
    print(f"Failed cases: {len(errors)}")

    if args.show_errors and errors:
        print("\nErrors")
        for err in errors:
            print(
                f"{err['id']}: label {err['expected_label']} -> {err['actual_label']}; "
                f"terms {err['expected_terms']} -> {err['actual_terms']}"
            )

    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
