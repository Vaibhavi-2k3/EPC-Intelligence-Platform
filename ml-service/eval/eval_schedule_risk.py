"""
Checks that predicted risk moves the right direction as each factor worsens,
holding everything else constant. No labeled test set for this one, so this
is the sanity check that matters.

Run from ml-service/:
    python -m eval.eval_schedule_risk
"""

import sys
from pathlib import Path

import joblib
import pandas as pd

sys.path.insert(0, str(Path(__file__).parent.parent))
from train_schedule_model import FEATURES  # noqa: E402

MODEL_PATH = Path(__file__).parent.parent / "models" / "schedule_risk_model.joblib"

BASELINE = {
    "lead_time_weeks": 12,
    "buffer_days": 10,
    "task_float_days": 5,
    "vendor_otd_rate": 0.85,
    "crew_dependency": 0,
    "change_order_count": 0,
}

# Each check: (feature, values to sweep from safest to riskiest, expected direction)
SWEEPS = [
    ("buffer_days", [30, 10, 0, -10, -20], "decreasing"),       # less buffer = more risk
    ("vendor_otd_rate", [0.95, 0.85, 0.70, 0.50, 0.30], "decreasing"),  # unreliable vendor = more risk
    ("task_float_days", [30, 15, 5, 0], "decreasing"),          # less float = more risk
    ("change_order_count", [0, 1, 2, 4], "increasing"),         # more change orders = more risk
]


def predict(model, features, overrides):
    row = {**BASELINE, **overrides}
    df = pd.DataFrame([{f: row[f] for f in features}])
    return float(model.predict_proba(df)[0][1])


def main():
    if not MODEL_PATH.exists():
        print(f"Model not found at {MODEL_PATH}. Run train_schedule_model.py first.")
        sys.exit(1)

    bundle = joblib.load(MODEL_PATH)
    model = bundle["model"]
    features = bundle["features"]

    print("=== Schedule Risk Model — Monotonicity Sanity Check ===")
    print("(Confirms risk moves the right direction as each factor worsens, all else held constant)\n")

    all_passed = True
    for feature, values, direction in SWEEPS:
        probs = [predict(model, features, {feature: v}) for v in values]
        if direction == "decreasing":
            # feature value decreases -> risk should increase (non-decreasing)
            passed = all(probs[i] <= probs[i + 1] + 1e-9 for i in range(len(probs) - 1))
        else:
            passed = all(probs[i] <= probs[i + 1] + 1e-9 for i in range(len(probs) - 1))
        all_passed = all_passed and passed
        status = "PASS" if passed else "FAIL"
        print(f"[{status}] {feature} sweep ({direction} values -> risk should rise as it worsens):")
        for v, p in zip(values, probs):
            print(f"    {feature}={v!r:<8} -> delay_probability={p:.3f}")
        print()

    print("=" * 60)
    print("ALL CHECKS PASSED" if all_passed else "SOME CHECKS FAILED — investigate before trusting this model")


if __name__ == "__main__":
    main()
