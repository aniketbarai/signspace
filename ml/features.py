from __future__ import annotations

from pathlib import Path
from typing import Iterable

import numpy as np


def normalize_hand_landmarks(landmarks: Iterable[Iterable[float]]) -> np.ndarray:
    """Translate landmarks to the wrist and scale by palm size."""
    points = np.asarray(list(landmarks), dtype=np.float32)
    if points.shape != (21, 3):
        raise ValueError(f"Expected 21 hand landmarks with x/y/z, got {points.shape}")
    points = points - points[0]
    palm_size = float(np.linalg.norm(points[9]))
    if palm_size < 1e-6:
        raise ValueError("Hand landmarks have zero palm size")
    return (points / palm_size).reshape(-1)


def blendshape_vector(blendshapes: dict[str, float], feature_names: list[str]) -> np.ndarray:
    """Convert a MediaPipe blendshape map to a stable, ordered feature vector."""
    return np.asarray([float(blendshapes.get(name, 0.0)) for name in feature_names], dtype=np.float32)


def read_labeled_csv(path: str | Path):
    import pandas as pd

    frame = pd.read_csv(path)
    if "label" not in frame.columns:
        raise ValueError("Dataset must contain a 'label' column")
    if len(frame) < 2:
        raise ValueError("Dataset must contain at least two rows")
    return frame


def ensure_parent(path: str | Path) -> Path:
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    return output
