import {
  Angry,
  AlertTriangle,
  Eye,
  Frown,
  Meh,
  Smile,
  ThumbsDown,
} from "lucide-react";
import { FaceLandmarker } from "@mediapipe/tasks-vision";
import type { EmotionName } from "./emotionClassifier";
import type { FacePoint } from "../hooks/useFaceLandmarker";

export const EMOTION_ICONS: Record<EmotionName, typeof Smile> = {
  Happy: Smile,
  Sad: Frown,
  Angry: Angry,
  Surprised: Eye,
  Fearful: AlertTriangle,
  Disgusted: ThumbsDown,
  Neutral: Meh,
};

export const EMOTION_COLORS: Record<EmotionName, string> = {
  Happy: "#e7b643",
  Sad: "#3068c9",
  Angry: "#c8543f",
  Surprised: "#c8408f",
  Fearful: "#7a5fd6",
  Disgusted: "#2e716e",
  Neutral: "#8a9490",
};

type FaceConnection = {
  start: number;
  end: number;
};

type FaceConnectionTuple = [number, number];

/**
 * Converts MediaPipe face connections into [start, end] tuples.
 */
function normalizeConnections(value: unknown): FaceConnectionTuple[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((connection): FaceConnectionTuple | null => {
      // Handle tuple format: [start, end]
      if (
        Array.isArray(connection) &&
        typeof connection[0] === "number" &&
        typeof connection[1] === "number"
      ) {
        return [connection[0], connection[1]];
      }

      // Handle MediaPipe object format: { start, end }
      if (connection !== null && typeof connection === "object") {
        const candidate = connection as Partial<FaceConnection>;

        if (
          typeof candidate.start === "number" &&
          typeof candidate.end === "number"
        ) {
          return [candidate.start, candidate.end];
        }
      }

      // Ignore malformed connections safely.
      return null;
    })
    .filter(
      (connection): connection is FaceConnectionTuple =>
        connection !== null,
    );
}

// Sparse contour groups used by the faceprint scan overlay.
export const FACE_CONNECTION_SETS: FaceConnectionTuple[][] = [
  normalizeConnections(
    (FaceLandmarker as any).FACE_LANDMARKS_FACE_OVAL,
  ),
  normalizeConnections(
    (FaceLandmarker as any).FACE_LANDMARKS_LEFT_EYE,
  ),
  normalizeConnections(
    (FaceLandmarker as any).FACE_LANDMARKS_RIGHT_EYE,
  ),
  normalizeConnections(
    (FaceLandmarker as any).FACE_LANDMARKS_LEFT_EYEBROW,
  ),
  normalizeConnections(
    (FaceLandmarker as any).FACE_LANDMARKS_RIGHT_EYEBROW,
  ),
  normalizeConnections(
    (FaceLandmarker as any).FACE_LANDMARKS_LIPS,
  ),
].filter((set) => set.length > 0);

export function faceBoundingBox(points: FacePoint[]) {
  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;

  for (const point of points) {
    if (point.x < minX) minX = point.x;
    if (point.x > maxX) maxX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.y > maxY) maxY = point.y;
  }

  const pad = 0.035;

  return {
    minX: Math.max(0, minX - pad),
    maxX: Math.min(1, maxX + pad),
    minY: Math.max(0, minY - pad * 1.4),
    maxY: Math.min(1, maxY + pad),
  };
}
