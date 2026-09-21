import base64
import binascii
import logging
import os
from typing import Any

import cv2
import numpy as np

# DeepFace 0.0.93 uses TensorFlow/Keras 3 integrations. This must be set before
# importing DeepFace so tf-keras is selected consistently on Windows.
os.environ.setdefault("TF_USE_LEGACY_KERAS", "1")

from deepface import DeepFace


logger = logging.getLogger("signspace.face-service")


class FaceInputError(Exception):
    """A safe, user-facing error caused by an invalid or unusable face image."""


def _setting(name: str, default: str) -> str:
    return os.getenv(name, default).strip() or default


MODEL_NAME = _setting("DEEPFACE_MODEL", "Facenet512")
DETECTOR_BACKEND = _setting("DEEPFACE_DETECTOR_BACKEND", "opencv")


def decode_image(encoded_image: str) -> np.ndarray:
    """Decode the existing raw-base64 or data-URL input into a BGR OpenCV image."""
    if not isinstance(encoded_image, str) or not encoded_image:
        raise FaceInputError("No face image was provided")

    payload = encoded_image.split(",", 1)[1] if encoded_image.startswith("data:") and "," in encoded_image else encoded_image
    try:
        raw = base64.b64decode(payload, validate=True)
    except (binascii.Error, ValueError) as error:
        raise FaceInputError("The face image is not valid base64") from error

    if len(raw) < 100 or len(raw) > 5 * 1024 * 1024:
        raise FaceInputError("The face image is empty or too large")

    array = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(array, cv2.IMREAD_COLOR)
    if image is None or image.size == 0:
        raise FaceInputError("The face image could not be decoded")
    return image


def _extract_single_face(image: np.ndarray) -> np.ndarray:
    """Detect exactly one face without allowing DeepFace to silently accept ambiguity."""
    debug = os.getenv("DEBUG", "false").lower() in {"1", "true", "yes"}
    try:
        detected = DeepFace.extract_faces(
            img_path=image,
            detector_backend=DETECTOR_BACKEND,
            enforce_detection=True,
            align=True,
        )
    except Exception as error:
        if debug:
            logger.exception("DeepFace detector error: %s", error)
        # OpenCV's bundled Haar cascade is a lightweight Windows fallback for
        # detector-runtime issues. DeepFace remains the primary detector.
        try:
            cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            boxes = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
        except Exception as fallback_error:
            if debug:
                logger.exception("OpenCV fallback detector error: %s", fallback_error)
            detail = f": {type(fallback_error).__name__}: {fallback_error}" if debug else ""
            raise FaceInputError(f"Face detection failed{detail}") from error

        if len(boxes) == 0:
            raise FaceInputError("No face detected. Move closer and make sure your face is well lit.") from error
        if len(boxes) > 1:
            raise FaceInputError("Multiple faces detected. Only one person can authenticate at a time.") from error
        x, y, width, height = boxes[0]
        return image[y : y + height, x : x + width]

    if not detected:
        raise FaceInputError("No face detected. Move closer and make sure your face is well lit.")
    if len(detected) > 1:
        raise FaceInputError("Multiple faces detected. Only one person can authenticate at a time.")

    face = detected[0].get("face")
    if not isinstance(face, np.ndarray) or face.size == 0:
        raise FaceInputError("The face image was too unclear to create a reliable embedding")

    height, width = face.shape[:2]
    if min(height, width) < 40:
        raise FaceInputError("The detected face is too small. Move closer and try again.")
    return face


def _representation(face: np.ndarray) -> list[float]:
    try:
        representations: list[dict[str, Any]] = DeepFace.represent(
            img_path=face,
            model_name=MODEL_NAME,
            detector_backend="skip",
            enforce_detection=False,
            align=False,
            normalization="base",
        )
    except Exception as error:
        if os.getenv("DEBUG", "false").lower() in {"1", "true", "yes"}:
            logger.exception("DeepFace representation error: %s", error)
        raise FaceInputError("Face embedding generation failed") from error

    if len(representations) != 1 or not representations[0].get("embedding"):
        raise FaceInputError("The face image was too unclear to create a reliable embedding")

    embedding = np.asarray(representations[0]["embedding"], dtype=np.float64)
    magnitude = np.linalg.norm(embedding)
    if embedding.ndim != 1 or embedding.size == 0 or magnitude == 0 or not np.isfinite(embedding).all():
        raise FaceInputError("The face embedding was invalid")
    return (embedding / magnitude).tolist()


def create_embedding(encoded_image: str) -> list[float]:
    """Create one normalized DeepFace embedding from the existing base64 input."""
    image = decode_image(encoded_image)
    face = _extract_single_face(image)
    return _representation(face)
