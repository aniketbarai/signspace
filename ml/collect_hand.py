"""Collect normalized MediaPipe hand landmarks into a labeled CSV.

Usage:
  python ml/collect_hand.py --label PINCH --samples 300 --output ml/data/hand_landmarks.csv

Press SPACE to save a detected hand; press Q to quit.
"""
from __future__ import annotations

import argparse
import csv
import time
from pathlib import Path

import cv2
import mediapipe as mp

from features import ensure_parent, normalize_hand_landmarks



def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--label", required=True, help="Class label, e.g. PINCH")
    parser.add_argument("--samples", type=int, default=300)
    parser.add_argument("--output", default="ml/data/hand_landmarks.csv")
    args = parser.parse_args()

    output = ensure_parent(args.output)
    exists = output.exists() and output.stat().st_size > 0
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        raise RuntimeError("Could not open webcam")

    hands = mp.solutions.hands
    saved = 0
    with hands.Hands(static_image_mode=False, max_num_hands=1, min_detection_confidence=0.65) as detector:
        with output.open("a", newline="") as handle:
            writer = csv.writer(handle)
            if not exists:
                writer.writerow([f"f{i}" for i in range(63)] + ["label"])
            while saved < args.samples:
                ok, frame = cap.read()
                if not ok:
                    continue
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                result = detector.process(rgb)
                message = f"{args.label}: {saved}/{args.samples} | SPACE capture | Q quit"
                if result.multi_hand_landmarks:
                    points = [[p.x, p.y, p.z] for p in result.multi_hand_landmarks[0].landmark]
                    try:
                        features = normalize_hand_landmarks(points)
                        for connection in hands.HAND_CONNECTIONS:
                            a, b = connection
                            pa, pb = result.multi_hand_landmarks[0].landmark[a], result.multi_hand_landmarks[0].landmark[b]
                            cv2.line(frame, (int(pa.x * frame.shape[1]), int(pa.y * frame.shape[0])), (int(pb.x * frame.shape[1]), int(pb.y * frame.shape[0])), (80, 220, 180), 2)
                    except ValueError:
                        features = None
                else:
                    features = None
                cv2.putText(frame, message, (15, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
                cv2.imshow("Hand dataset collector", frame)
                key = cv2.waitKey(1) & 0xFF
                if key in (ord("q"), ord("Q")):
                    break
                if key == 32 and features is not None:
                    writer.writerow([f"{value:.7f}" for value in features] + [args.label])
                    handle.flush()
                    saved += 1
                    time.sleep(0.08)
    cap.release()
    cv2.destroyAllWindows()
    print(f"Saved {saved} samples to {output}")


if __name__ == "__main__":
    main()
