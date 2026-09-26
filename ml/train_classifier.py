"""Train a landmark/blendshape classifier and save metrics plus the model.

Examples:
  python ml/train_classifier.py --input ml/data/hand_landmarks.csv --model ml/models/hand_gesture.joblib
  python ml/train_classifier.py --input ml/data/facial_blendshapes.csv --model ml/models/facial_expression.joblib
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import joblib
import matplotlib.pyplot as plt
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import ConfusionMatrixDisplay, classification_report
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.neural_network import MLPClassifier

from features import ensure_parent, read_labeled_csv


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--model", required=True)
    parser.add_argument("--algorithm", choices=("random_forest", "mlp"), default="random_forest")
    parser.add_argument("--test-size", type=float, default=0.2)
    args = parser.parse_args()

    frame = read_labeled_csv(args.input)
    X = frame.drop(columns=["label"]).apply(pd.to_numeric, errors="raise")
    y = frame["label"].astype(str)
    if y.nunique() < 2:
        raise ValueError("Training requires at least two different labels")
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=args.test_size, stratify=y, random_state=42)

    if args.algorithm == "mlp":
        model = Pipeline([("scale", StandardScaler()), ("classifier", MLPClassifier(hidden_layer_sizes=(64, 32), max_iter=500, early_stopping=False, random_state=42))])
    else:
        model = RandomForestClassifier(n_estimators=300, class_weight="balanced", random_state=42, n_jobs=-1)
    model.fit(X_train, y_train)
    predictions = model.predict(X_test)
    report = classification_report(y_test, predictions, output_dict=True, zero_division=0)

    model_path = ensure_parent(args.model)
    joblib.dump({"model": model, "features": list(X.columns), "labels": sorted(y.unique().tolist())}, model_path)
    metrics_path = model_path.with_suffix(".metrics.json")
    metrics_path.write_text(json.dumps({"algorithm": args.algorithm, "rows": len(frame), "labels": sorted(y.unique().tolist()), "report": report}, indent=2))
    image_path = model_path.with_suffix(".confusion-matrix.png")
    ConfusionMatrixDisplay.from_predictions(y_test, predictions, xticks_rotation="vertical", colorbar=False)
    plt.tight_layout()
    plt.savefig(image_path, dpi=160)
    plt.close()
    print(json.dumps({"model": str(model_path), "metrics": str(metrics_path), "confusion_matrix": str(image_path), "accuracy": report.get("accuracy", 0)}, indent=2))


if __name__ == "__main__":
    main()
