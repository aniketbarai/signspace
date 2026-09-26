from __future__ import annotations

import os
from typing import Any

import numpy as np

FEATURE_NAMES = [
    "mouthSmileLeft", "mouthSmileRight", "cheekSquintLeft", "cheekSquintRight",
    "mouthFrownLeft", "mouthFrownRight", "mouthLowerDownLeft", "mouthLowerDownRight",
    "browDownLeft", "browDownRight", "browInnerUp", "eyeWideLeft", "eyeWideRight",
    "jawOpen", "noseSneerLeft", "noseSneerRight", "mouthUpperUpLeft", "mouthUpperUpRight",
    "mouthPressLeft", "mouthPressRight", "mouthStretchLeft", "mouthStretchRight",
    "eyeSquintLeft", "eyeSquintRight",
]

_MODEL_PATH = os.getenv("FACIAL_EXPRESSION_MODEL", "").strip()
_trained_model = None
if _MODEL_PATH:
    try:
        import joblib

        artifact = joblib.load(_MODEL_PATH)
        _trained_model = artifact["model"] if isinstance(artifact, dict) else artifact
    except Exception:
        _trained_model = None


def predict_expression(blendshapes: dict[str, Any]) -> dict[str, Any]:
    values = np.asarray([[float(blendshapes.get(name, 0.0)) for name in FEATURE_NAMES]], dtype=np.float32)
    if _trained_model is None:
        return {"expression": "MODEL_NOT_CONFIGURED", "confidence": 0.0, "scores": {}}
    try:
        expression = str(_trained_model.predict(values)[0])
        scores: dict[str, float] = {}
        if hasattr(_trained_model, "predict_proba"):
            probabilities = _trained_model.predict_proba(values)[0]
            labels = getattr(_trained_model, "classes_", [])
            scores = {str(label): round(float(score), 4) for label, score in zip(labels, probabilities)}
        confidence = max(scores.values(), default=0.0)
        return {"expression": expression, "confidence": round(confidence, 4), "scores": scores}
    except Exception as error:
        raise RuntimeError("Facial expression model inference failed") from error
