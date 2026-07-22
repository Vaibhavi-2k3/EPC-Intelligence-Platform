"""
Trains the delay-risk model. Run this whenever you have new data —
outputs models/schedule_risk_model.joblib.
"""

import joblib
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.inspection import permutation_importance
from sklearn.metrics import roc_auc_score, accuracy_score, classification_report

from data_gen import generate_schedule_training_data

FEATURES = [
    "lead_time_weeks",
    "buffer_days",
    "task_float_days",
    "vendor_otd_rate",
    "crew_dependency",
    "change_order_count",
]

# 1 = feature going up can only push risk up, -1 = only push it down, 0 = no constraint.
# Plain RandomForest let a couple of these go backwards in sparse regions (see
# eval/eval_schedule_risk.py) — this fixes it.
MONOTONIC_CONSTRAINTS = {
    "lead_time_weeks": 1,
    "buffer_days": -1,
    "task_float_days": -1,
    "vendor_otd_rate": -1,
    "crew_dependency": 1,
    "change_order_count": 1,
}

def main():
    df = generate_schedule_training_data(n=1500)
    X = df[FEATURES]
    y = df["delayed"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = HistGradientBoostingClassifier(
        max_iter=250,
        max_depth=4,
        learning_rate=0.08,
        monotonic_cst=[MONOTONIC_CONSTRAINTS[f] for f in FEATURES],
        random_state=42,
    )
    model.fit(X_train, y_train)

    proba = model.predict_proba(X_test)[:, 1]
    preds = model.predict(X_test)

    print("=== Schedule Risk Model — Holdout Evaluation ===")
    print(f"Accuracy: {accuracy_score(y_test, preds):.3f}")
    print(f"ROC AUC:  {roc_auc_score(y_test, proba):.3f}")
    print(classification_report(y_test, preds, target_names=["on_time", "delayed"]))
    print("Monotonic constraints applied:", MONOTONIC_CONSTRAINTS)

    # HGB has no feature_importances_ attribute, so compute permutation
    # importance once here and save it — API just reads this instead of
    # recomputing per request.
    perm = permutation_importance(model, X_test, y_test, n_repeats=15, random_state=42, scoring="roc_auc")
    feature_importances = {
        f: round(float(v), 3) for f, v in zip(FEATURES, perm.importances_mean)
    }
    print("Permutation feature importances (ROC AUC drop):", feature_importances)

    joblib.dump(
        {"model": model, "features": FEATURES, "feature_importances": feature_importances},
        "models/schedule_risk_model.joblib",
    )
    print("\nSaved to models/schedule_risk_model.joblib")


if __name__ == "__main__":
    main()
