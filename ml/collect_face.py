"""Collect MediaPipe FaceLandmarker blendshapes into a labeled CSV.

Usage:
  python ml/collect_face.py --label Happy --samples 300 --output ml/data/facial_blendshapes.csv

Press SPACE to save the current face blendshape vector; press Q to quit.
The collector expects a local FaceLandmarker .task model path.
"""
from __future__ import annotations

import argparse
import csv
import time
from pathlib import Path

import cv2
import mediapipe as mp

from features import ensure_parent

DEFAULT_FEATURES = [
    "mouthSmileLeft", "mouthSmileRight", "cheekSquintLeft", "cheekSquintRight",
    "mouthFrownLeft", "mouthFrownRight", "mouthLowerDownLeft", "mouthLowerDownRight",
    "browDownLeft", "browDownRight", "browInnerUp", "eyeWideLeft", "eyeWideRight",
    "jawOpen", "noseSneerLeft", "noseSneerRight", "mouthUpperUpLeft", "mouthUpperUpRight",
    "mouthPressLeft", "mouthPressRight", "mouthStretchLeft", "mouthStretchRight",
    "eyeSquintLeft", "eyeSquintRight",
]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", required=True, help="Class label, e.g. Happy")
    parser.add_argument("--samples", type=int, default=300)
    parser.add_argument("--model", required=True, help="Path to face_landmarker.task")
    parser.add_argument("--output", default="ml/data/facial_blendshapes.csv")
    args = parser.parse_args()

    output = ensure_parent(args.output)
    exists = output.exists() and output.stat().st_size > 0
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Could not open webcam")

    base = mp.tasks.BaseOptions
    options = mp.tasks.vision.FaceLandmarkerOptions(
        base_options=base(model_asset_path=args.model),
        running_mode=mp.tasks.vision.RunningMode.VIDEO,
        num_faces=1,
        output_face_blendshapes=True,
    )
    saved = 0
    with mp.tasks.vision.FaceLandmarker.create_from_options(options) as detector:
        with output.open("a", newline="") as handle:
            writer = csv.writer(handle)
            if not exists:
                writer.writerow(DEFAULT_FEATURES + ["label"])
            while saved < args.samples:
                ok, frame = cap.read()
                if not ok:
                    continue
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                result = detector.detect_for_video(image, int(time.monotonic() * 1000))
                vector = None
                if result.face_blendshapes:
                    values = {item.category_name: item.score for item in result.face_blendshapes[0]}
                    vector = [float(values.get(name, 0.0)) for name in DEFAULT_FEATURES]
                cv2.putText(frame, f"{args.label}: {saved}/{args.samples} | SPACE capture | Q quit", (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
                cv2.imshow("Expression dataset collector", frame)
                key = cv2.waitKey(1) & 0xFF
                if key in (ord("q"), ord("Q")):
                    break
                if key == 32 and vector is not None:
                    writer.writerow([f"{value:.7f}" for value in vector] + [args.label])
                    handle.flush()
                    saved += 1
                    time.sleep(0.08)
    cap.release()
    cv2.destroyAllWindows()
    print(f"Saved {saved} samples to {output}")


if __name__ == "__main__":
    main()
