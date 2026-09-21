export type Landmark = { x: number; y: number; z: number };
export type GestureName = "NO_HAND" | "OPEN_PALM" | "FIST" | "POINT" | "PINCH" | "THUMBS_UP" | "VICTORY" | "HAND";

// MediaPipe's 21-point hand topology, used to draw the skeleton overlay.
export const HAND_CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

const FINGER_PAIRS: [number, number][] = [
  [8, 6],
  [12, 10],
  [16, 14],
  [20, 18],
];

function distance(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Mirrors the classification thresholds in ai-service/hand_service.py so the
 * in-browser and server paths agree on what a gesture means. Runs directly on
 * landmarks produced by the on-device MediaPipe HandLandmarker, so there is no
 * network round trip and no per-frame JPEG upload.
 */
export function classifyGesture(landmarks: Landmark[]): { gesture: GestureName; confidence: number } {
  if (landmarks.length !== 21) return { gesture: "NO_HAND", confidence: 0 };

  const wrist = landmarks[0];
  const palmSize = Math.max(distance(wrist, landmarks[9]), 0.05);
  const thumbTip = landmarks[4];
  const thumbIp = landmarks[3];
  const thumbExtended = distance(thumbTip, landmarks[5]) > distance(thumbIp, landmarks[5]) * 1.12;
  const fingersExtended = FINGER_PAIRS.map(([tip, pip]) => distance(landmarks[tip], wrist) > distance(landmarks[pip], wrist) * 1.08);
  const extendedCount = fingersExtended.filter(Boolean).length + (thumbExtended ? 1 : 0);
  const pinchRatio = distance(thumbTip, landmarks[8]) / palmSize;

  if (pinchRatio < 0.42 && !fingersExtended[1]) {
    return { gesture: "PINCH", confidence: Math.min(0.99, 0.82 + (0.42 - pinchRatio)) };
  }
  if (thumbExtended && !fingersExtended.some(Boolean)) {
    return { gesture: "THUMBS_UP", confidence: 0.88 };
  }
  if (fingersExtended[0] && fingersExtended[1] && !fingersExtended[2] && !fingersExtended[3]) {
    return { gesture: "VICTORY", confidence: 0.9 };
  }
  if (fingersExtended[0] && !fingersExtended[1] && !fingersExtended[2] && !fingersExtended[3]) {
    return { gesture: "POINT", confidence: 0.88 };
  }
  if (extendedCount >= 4) return { gesture: "OPEN_PALM", confidence: 0.92 };
  if (extendedCount === 0) return { gesture: "FIST", confidence: 0.9 };
  return { gesture: "HAND", confidence: 0.56 };
}
