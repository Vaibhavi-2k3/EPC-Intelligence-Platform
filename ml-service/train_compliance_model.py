"""
Trains the deviation-severity text classifier (TF-IDF + LogisticRegression).
Used to cross-check the LLM's severity call on compliance findings.
"""

import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

from data_gen import generate_compliance_training_data


def main():
    df = generate_compliance_training_data(n_per_class=180)

    X_train, X_test, y_train, y_test = train_test_split(
        df["text"], df["severity"], test_size=0.2, random_state=7, stratify=df["severity"]
    )

    pipeline = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=2, max_features=3000)),
        ("clf", LogisticRegression(max_iter=1000, C=3.0)),
    ])
    pipeline.fit(X_train, y_train)

    preds = pipeline.predict(X_test)
    print("=== Compliance Severity Classifier — Holdout Evaluation ===")
    print(f"Accuracy: {accuracy_score(y_test, preds):.3f}")
    print(classification_report(y_test, preds))

    joblib.dump(pipeline, "models/compliance_severity_model.joblib")
    print("\nSaved to models/compliance_severity_model.joblib")


if __name__ == "__main__":
    main()
