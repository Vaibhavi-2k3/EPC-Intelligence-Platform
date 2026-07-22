"""
Scores the compliance classifier against hand-written test cases (different
phrasing than the training data) and reports precision/recall/F1 + confusion matrix.

Run from ml-service/:
    python -m eval.eval_compliance
"""

import json
import sys
from pathlib import Path

import joblib
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    precision_recall_fscore_support,
)

sys.path.insert(0, str(Path(__file__).parent.parent))
from eval.test_cases import TEST_CASES  # noqa: E402

MODEL_PATH = Path(__file__).parent.parent / "models" / "compliance_severity_model.joblib"


def main():
    if not MODEL_PATH.exists():
        print(f"Model not found at {MODEL_PATH}. Run train_compliance_model.py first.")
        sys.exit(1)

    model = joblib.load(MODEL_PATH)

    texts = [c["text"] for c in TEST_CASES]
    y_true = [c["expected"] for c in TEST_CASES]
    y_pred = list(model.predict(texts))

    labels = ["critical", "major", "minor", "ok"]

    print("=== Compliance Severity Classifier — Held-Out Test Case Evaluation ===")
    print(f"Test cases: {len(TEST_CASES)} (hand-written, different phrasing than training data)\n")

    print(classification_report(y_true, y_pred, labels=labels, zero_division=0))

    cm = confusion_matrix(y_true, y_pred, labels=labels)
    print("Confusion matrix (rows = true, cols = predicted):")
    header = "            " + "  ".join(f"{l:>9}" for l in labels)
    print(header)
    for i, row in enumerate(cm):
        print(f"{labels[i]:>10}  " + "  ".join(f"{v:9d}" for v in row))

    print("\nMisclassified cases:")
    any_wrong = False
    for case, pred in zip(TEST_CASES, y_pred):
        if pred != case["expected"]:
            any_wrong = True
            print(f'  expected={case["expected"]:<9} predicted={pred:<9} text="{case["text"][:80]}..."')
    if not any_wrong:
        print("  (none — all held-out test cases classified correctly)")

    precision, recall, f1, support = precision_recall_fscore_support(
        y_true, y_pred, labels=labels, zero_division=0
    )
    report = {
        "n_test_cases": len(TEST_CASES),
        "per_class": {
            labels[i]: {
                "precision": round(float(precision[i]), 3),
                "recall": round(float(recall[i]), 3),
                "f1": round(float(f1[i]), 3),
                "support": int(support[i]),
            }
            for i in range(len(labels))
        },
        "accuracy": round(sum(1 for a, b in zip(y_true, y_pred) if a == b) / len(y_true), 3),
    }

    out_path = Path(__file__).parent / "compliance_eval_report.json"
    with open(out_path, "w") as f:
        json.dump(report, f, indent=2)
    print(f"\nSaved machine-readable report to {out_path}")


if __name__ == "__main__":
    main()
