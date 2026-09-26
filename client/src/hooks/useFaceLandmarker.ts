import { useEffect, useRef, useState } from "react";
import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import { blendshapesToEmotion, EmotionSmoother, type BlendshapeMap, type EmotionResult } from "../lib/emotionClassifier";

const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.17/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export type FacePoint = { x: number; y: number; z: number };

export type FaceTrackingResult = {
  present: boolean;
  landmarks: FacePoint[]; // 478 normalized points when present
  emotion: EmotionResult;
  fps: number;
};

const NEUTRAL_EMOTION: EmotionResult = {
  scores: { Happy: 0, Sad: 0, Angry: 0, Surprised: 0, Fearful: 0, Disgusted: 0, Neutral: 1 },
  dominant: "Neutral",
  confidence: 0,
};

const idle: FaceTrackingResult = { present: false, landmarks: [], emotion: NEUTRAL_EMOTION, fps: 0 };

/**
 * Runs MediaPipe's FaceLandmarker in-browser against the live video feed,
 * requesting the 52 ARKit-style face blendshapes alongside the 478-point
 * mesh. The blendshapes (real per-muscle activation scores, not a mock) are
 * turned into emotion scores every frame via blendshapesToEmotion, then
 * smoothed so the readout is stable enough to read.
 */
export function useFaceLandmarker(videoRef: React.RefObject<HTMLVideoElement | null>, active: boolean) {
  const [result, setResult] = useState<FaceTrackingResult>(idle);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const landmarkerRef = useRef<FaceLandmarker | null>(null);
  const smootherRef = useRef(new EmotionSmoother());
  const rafRef = useRef<number>(0);
  const frameTimesRef = useRef<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
        const landmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
          runningMode: "VIDEO",
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: false,
          minFaceDetectionConfidence: 0.55,
          minFacePresenceConfidence: 0.55,
          minTrackingConfidence: 0.55,
        });
        if (cancelled) {
          landmarker.close();
          return;
        }
        landmarkerRef.current = landmarker;
        setReady(true);
      } catch {
        if (!cancelled) setLoadError("Face tracking model could not be loaded. Check your connection and reload.");
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
        let detection: FaceLandmarkerResult | null = null;
        try {
          detection = landmarker.detectForVideo(video, now);
        } catch {
          detection = null;
        }

        const times = frameTimesRef.current;
        times.push(now);
        while (times.length > 30) times.shift();
        const fps = times.length > 1 ? Math.round((1000 * (times.length - 1)) / (times[times.length - 1] - times[0])) : 0;

        const face = detection?.faceLandmarks?.[0];
        const shapesList = detection?.faceBlendshapes?.[0]?.categories;

        if (face && face.length > 0) {
          const blendshapes: BlendshapeMap = {};
          shapesList?.forEach((category) => {
            blendshapes[category.categoryName] = category.score;
          });
          const emotion = smootherRef.current.smooth(blendshapesToEmotion(blendshapes));
          setResult({ present: true, landmarks: face, emotion, fps });
        } else {
          smootherRef.current.reset();
          setResult({ ...idle, fps });
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
