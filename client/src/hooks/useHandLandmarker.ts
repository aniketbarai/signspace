import { useEffect, useRef, useState } from "react";
import { FilesetResolver, HandLandmarker, type HandLandmarkerResult } from "@mediapipe/tasks-vision";
import { LandmarkSmoother } from "../lib/oneEuroFilter";
import { classifyGesture, type GestureName, type Landmark } from "../lib/handGestures";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm";
const MODEL_URL = "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export type HandTrackingResult = {
  gesture: GestureName;
  confidence: number;
  landmarks: Landmark[];
  handedness: string | null;
  fps: number;
};

const idle: HandTrackingResult = { gesture: "NO_HAND", confidence: 0, landmarks: [], handedness: null, fps: 0 };

/**
 * Runs hand tracking entirely in the browser (WASM + optional WebGL delegate),
 * detecting continuously against the live video frame. This replaces the old
 * "capture a JPEG, POST it, wait for a reply" loop that ran a handful of times
 * a second: this hook drives at native video frame rate, which is what makes
 * pinch-to-draw feel smooth instead of stepped.
 */
export function useHandLandmarker(videoRef: React.RefObject<HTMLVideoElement | null>, active: boolean) {
  const [result, setResult] = useState<HandTrackingResult>(idle);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const smootherRef = useRef(new LandmarkSmoother());
  const rafRef = useRef<number>(0);
  const frameTimesRef = useRef<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
        const landmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numHands: 1,
          minHandDetectionConfidence: 0.6,
          minHandPresenceConfidence: 0.6,
          minTrackingConfidence: 0.6,
        });
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setReady(true);
      } catch {
        if (!cancelled) setLoadError("Hand tracking model could not be loaded. Check your connection and reload.");
      }
    })();

    return () => {
      cancelled = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!active || !ready) return;
    let cancelled = false;

    const loop = () => {
      if (cancelled) return;
      const video = videoRef.current;
      const landmarker = landmarkerRef.current;

      if (video && landmarker && video.readyState >= 2 && video.videoWidth > 0) {
        const now = performance.now();
        let detection: HandLandmarkerResult | null = null;
        try {
          detection = landmarker.detectForVideo(video, now);
        } catch {
          detection = null;
        }

        const times = frameTimesRef.current;
        times.push(now);
        while (times.length > 30) times.shift();
        const fps = times.length > 1 ? Math.round((1000 * (times.length - 1)) / (times[times.length - 1] - times[0])) : 0;

        const rawHand = detection?.landmarks?.[0];
        if (rawHand && rawHand.length === 21) {
          const smoothed = smootherRef.current.smooth(rawHand, now);
          const { gesture, confidence } = classifyGesture(smoothed);
          const handedness = detection?.handedness?.[0]?.[0]?.categoryName ?? null;
          setResult({ gesture, confidence, landmarks: smoothed, handedness, fps });
        } else {
          smootherRef.current.reset();
          setResult((prev) => ({ ...idle, fps }));
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
    };
  }, [active, ready, videoRef]);

  return { result, ready, loadError };
}
