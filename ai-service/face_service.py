import base64
import binascii
import logging
import os
from typing import Any

import cv2
import numpy as np
from deepface import DeepFace


class FaceInputError(Exception):
    """A safe, user-facing error caused by an invalid or unusable face image."""


def _setting(name: str, default: str) -> str:
    return os.getenv(name, default).strip() or default


MODEL_NAME = _setting("DEEPFACE_MODEL", "Facenet512")
DETECTOR_BACKEND = _setting("DEEPFACE_DETECTOR_BACKEND", "opencv")
FALLBACK_DETECTOR_BACKENDS = tuple(
    backend
    for backend in (DETECTOR_BACKEND, "mtcnn")
    if backend
)
logger = logging.getLogger("face-ai")
EYE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")


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
    last_error: Exception | None = None
    for detector_backend in dict.fromkeys(FALLBACK_DETECTOR_BACKENDS):
        try:
            detected = DeepFace.extract_faces(
                img_path=image,
                detector_backend=detector_backend,
                enforce_detection=True,
                align=True,
            )
            break
        except ValueError as error:
            last_error = error
            logger.info("No face detected with %s backend: %s", detector_backend, error)
        except Exception as error:
            last_error = error
            logger.exception("Face detection failed with %s backend", detector_backend)
    else:
        if isinstance(last_error, ValueError):
            raise FaceInputError("No face detected. Move closer and make sure your face is well lit.") from last_error
        raise FaceInputError("Face detection failed. Try better lighting and keep your face centered.") from last_error

    if not detected:
        raise FaceInputError("No face detected. Move closer and make sure your face is well lit.")
    if len(detected) > 1:
        raise FaceInputError("Multiple faces detected. Only one person can authenticate at a time.")

    face = detected[0].get("face")
    if not isinstance(face, np.ndarray) or face.size == 0:
        raise FaceInputError("The face image was too unclear to create a reliable embedding")

    height, width = face.shape[:2]
    if min(height, width) < 96:
        raise FaceInputError("The detected face is too small. Move closer and try again.")
    _validate_face_quality(face)
    return face


def _validate_face_quality(face: np.ndarray) -> None:
    face_uint8 = (np.clip(face, 0, 1) * 255).astype(np.uint8) if face.dtype != np.uint8 else face
    gray = cv2.cvtColor(face_uint8, cv2.COLOR_BGR2GRAY)
    brightness = float(np.mean(gray))
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    if brightness < 45:
        raise FaceInputError("Face is too dark. Move into better lighting and try again.")
    if brightness > 225:
        raise FaceInputError("Face is overexposed. Reduce bright light and try again.")
    if sharpness < 35:
        raise FaceInputError("Face is too blurry. Hold still and try again.")

    upper_face = gray[: max(1, gray.shape[0] // 2), :]
    eyes = EYE_CASCADE.detectMultiScale(
        upper_face,
        scaleFactor=1.08,
        minNeighbors=4,
        minSize=(18, 18),
    )
    if len(eyes) < 1:
        raise FaceInputError("Eyes were not clearly visible. Face the camera and keep your eyes open.")


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
