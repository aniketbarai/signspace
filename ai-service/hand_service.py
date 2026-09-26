import base64
import binascii
import os
from typing import Any

import cv2
import mediapipe as mp
import numpy as np

_MODEL_PATH = os.getenv("HAND_GESTURE_MODEL", "").strip()
_trained_model = None
if _MODEL_PATH:
    try:
        import joblib

        artifact = joblib.load(_MODEL_PATH)
        _trained_model = artifact["model"] if isinstance(artifact, dict) else artifact
    except Exception:
        # Keep the service available with the deterministic baseline classifier.
        _trained_model = None


class HandInputError(Exception):
    """A safe, user-facing hand-recognition error."""


try:
    # The legacy Solutions API is used by this implementation. MediaPipe
    # 0.10.30+ removes it, so keep the failure actionable for stale venvs.
    _mp_hands = mp.solutions.hands
except AttributeError as error:
    raise RuntimeError(
        "Incompatible MediaPipe version: install mediapipe==0.10.21 "
        "because newer versions removed the solutions API."
    ) from error


# MediaPipe landmark indices for each finger.
_FINGER_PAIRS = ((8, 6), (12, 10), (16, 14), (20, 18))


def decode_hand_image(encoded_image: str) -> np.ndarray:
    if not isinstance(encoded_image, str) or not encoded_image:
        raise HandInputError("No hand image was provided")
    payload = encoded_image.split(",", 1)[1] if encoded_image.startswith("data:") and "," in encoded_image else encoded_image
    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as error:
        raise HandInputError("The hand image is not valid base64") from error
    if len(raw) < 100 or len(raw) > 5 * 1024 * 1024:
        raise HandInputError("The hand image is empty or too large")
    image = cv2.imdecode(np.frombuffer(raw, dtype=np.uint8), cv2.IMREAD_COLOR)
    if image is None or image.size == 0:
        raise HandInputError("The hand image could not be decoded")
    return cv2.cvtColor(image, cv2.COLOR_BGR2RGB)


def _distance(a: Any, b: Any) -> float:
    return float(np.hypot(a.x - b.x, a.y - b.y))


def _model_features(landmarks: list[Any]) -> np.ndarray:
    points = np.asarray([[point.x, point.y, point.z] for point in landmarks], dtype=np.float32)
    points = points - points[0]
    palm_size = float(np.linalg.norm(points[9]))
    if palm_size < 1e-6:
        raise HandInputError("Hand landmarks are too small to classify")
    return (points / palm_size).reshape(1, -1)


def _predict_with_model(landmarks: list[Any]) -> tuple[str, float] | None:
    if _trained_model is None:
        return None
    try:
        features = _model_features(landmarks)
        label = str(_trained_model.predict(features)[0])
        confidence = 0.0
        if hasattr(_trained_model, "predict_proba"):
            confidence = float(np.max(_trained_model.predict_proba(features)[0]))
        return label, round(confidence, 3)
    except Exception:
        return None


def _classify(landmarks: list[Any], handedness: str) -> tuple[str, float]:
    wrist = landmarks[0]
    palm_size = max(_distance(wrist, landmarks[9]), 0.05)
    thumb_tip, thumb_ip = landmarks[4], landmarks[3]
    thumb_extended = _distance(thumb_tip, landmarks[5]) > _distance(thumb_ip, landmarks[5]) * 1.12
    fingers_extended = [_distance(landmarks[tip], wrist) > _distance(landmarks[pip], wrist) * 1.08 for tip, pip in _FINGER_PAIRS]
    extended_count = sum(fingers_extended) + int(thumb_extended)
    pinch_ratio = _distance(thumb_tip, landmarks[8]) / palm_size

    if pinch_ratio < 0.42 and fingers_extended[1] is False:
        return "PINCH", min(0.99, 0.82 + (0.42 - pinch_ratio))
    if thumb_extended and not any(fingers_extended):
        return "THUMBS_UP", 0.88
    if fingers_extended == [True, True, False, False]:
        return "VICTORY", 0.9
    if fingers_extended == [True, False, False, False]:
        return "POINT", 0.88
    if extended_count >= 4:
        return "OPEN_PALM", 0.92
    if extended_count == 0:
        return "FIST", 0.9
    return "HAND", 0.56


def recognize_gesture(encoded_image: str) -> dict[str, Any]:
    image = decode_hand_image(encoded_image)
    try:
        with _mp_hands.Hands(
            static_image_mode=True,
            max_num_hands=1,
            model_complexity=1,
            min_detection_confidence=0.65,
            min_tracking_confidence=0.65,
        ) as hands:
            result = hands.process(image)
    except Exception as error:
        raise HandInputError("Hand recognition failed") from error

    if not result.multi_hand_landmarks:
        return {"gesture": "NO_HAND", "confidence": 0.0, "landmarks": [], "handedness": None}

    hand = result.multi_hand_landmarks[0]
    handedness = result.multi_handedness[0].classification[0].label if result.multi_handedness else "Unknown"
    prediction = _predict_with_model(hand.landmark)
    gesture, confidence = prediction if prediction else _classify(hand.landmark, handedness)
    landmarks = [{"x": round(point.x, 5), "y": round(point.y, 5), "z": round(point.z, 5)} for point in hand.landmark]
    return {
        "gesture": gesture,
        "confidence": round(float(confidence), 3),
        "landmarks": landmarks,
        "handedness": handedness,
    }
