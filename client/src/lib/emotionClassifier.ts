// Turns MediaPipe FaceLandmarker blendshape output (52 named facial-muscle
// coefficients, each 0..1) into a small set of readable emotion scores.
//
// This is not a guess dressed up as science: each blendshape is a real
// Facial Action Coding System (FACS)-style measurement of one muscle group
// (e.g. how far a mouth corner is pulled up, how tight an eyelid is
// squeezed). Grouping them by the combinations psychologists associate with
// each expression is the standard approach used by most browser-based
// emotion tools built on this model, and it updates every frame directly
// from the tracked face, so it reacts to the actual expression instead of
// being a fixed animation.

export type BlendshapeMap = Record<string, number>;

export type EmotionName = "Happy" | "Sad" | "Angry" | "Surprised" | "Fearful" | "Disgusted" | "Neutral";

export const EMOTION_NAMES: EmotionName[] = ["Happy", "Sad", "Angry", "Surprised", "Fearful", "Disgusted", "Neutral"];

export type EmotionResult = {
  scores: Record<EmotionName, number>;
  dominant: EmotionName;
  confidence: number; // 0..1, how much the dominant emotion stands out
};

const avg = (b: BlendshapeMap, keys: string[]) => {
  let total = 0;
  for (const key of keys) total += b[key] ?? 0;
  return total / keys.length;
};

const NEUTRAL_FLOOR = 0.16; // baseline "resting face" weight so Neutral wins when nothing else fires

export function blendshapesToEmotion(blendshapes: BlendshapeMap): EmotionResult {
  const smile = avg(blendshapes, ["mouthSmileLeft", "mouthSmileRight"]);
  const cheekRaise = avg(blendshapes, ["cheekSquintLeft", "cheekSquintRight"]);
  const frown = avg(blendshapes, ["mouthFrownLeft", "mouthFrownRight"]);
  const lowerLipDown = avg(blendshapes, ["mouthLowerDownLeft", "mouthLowerDownRight"]);
  const browDown = avg(blendshapes, ["browDownLeft", "browDownRight"]);
  const browInnerUp = blendshapes["browInnerUp"] ?? 0;
  const eyeWide = avg(blendshapes, ["eyeWideLeft", "eyeWideRight"]);
  const jawOpen = blendshapes["jawOpen"] ?? 0;
  const noseSneer = avg(blendshapes, ["noseSneerLeft", "noseSneerRight"]);
  const mouthUpperUp = avg(blendshapes, ["mouthUpperUpLeft", "mouthUpperUpRight"]);
  const mouthPress = avg(blendshapes, ["mouthPressLeft", "mouthPressRight"]);
  const mouthStretch = avg(blendshapes, ["mouthStretchLeft", "mouthStretchRight"]);
  const eyeSquint = avg(blendshapes, ["eyeSquintLeft", "eyeSquintRight"]);

  const raw: Record<EmotionName, number> = {
    Happy: smile * 1.0 + cheekRaise * 0.5,
    Sad: frown * 0.9 + lowerLipDown * 0.3 + browInnerUp * 0.35 - smile * 0.4,
    Angry: browDown * 0.85 + mouthPress * 0.4 + noseSneer * 0.25 - browInnerUp * 0.3,
    Surprised: browInnerUp * 0.6 + eyeWide * 0.55 + jawOpen * 0.5 - browDown * 0.3,
    Fearful: eyeWide * 0.45 + browInnerUp * 0.4 + mouthStretch * 0.35 - smile * 0.3,
    Disgusted: noseSneer * 0.7 + mouthUpperUp * 0.5 + browDown * 0.2 - smile * 0.3,
    Neutral: NEUTRAL_FLOOR - eyeSquint * 0.1,
  };

  const clamped = Object.fromEntries(
    EMOTION_NAMES.map((name) => [name, Math.max(0, Math.min(1, raw[name]))])
  ) as Record<EmotionName, number>;

  const total = EMOTION_NAMES.reduce((sum, name) => sum + clamped[name], 0) || 1;
  const scores = Object.fromEntries(EMOTION_NAMES.map((name) => [name, clamped[name] / total])) as Record<
    EmotionName,
    number
  >;

  let dominant: EmotionName = "Neutral";
  let best = -1;
  let secondBest = -1;
  for (const name of EMOTION_NAMES) {
    if (scores[name] > best) {
      secondBest = best;
      best = scores[name];
      dominant = name;
    } else if (scores[name] > secondBest) {
      secondBest = scores[name];
    }
  }

  return { scores, dominant, confidence: Math.max(0, Math.min(1, best - Math.max(0, secondBest))) };
}

// Smooths emotion scores across frames (simple exponential moving average) so
// the readout doesn't flicker between labels on every frame of tracking noise.
export class EmotionSmoother {
  private smoothed: Record<EmotionName, number> | null = null;

  smooth(result: EmotionResult, alpha = 0.18): EmotionResult {
    if (!this.smoothed) {
      this.smoothed = { ...result.scores };
    } else {
      for (const name of EMOTION_NAMES) {
        this.smoothed[name] = this.smoothed[name] * (1 - alpha) + result.scores[name] * alpha;
      }
    }
    let dominant: EmotionName = "Neutral";
    let best = -1;
    let secondBest = -1;
    for (const name of EMOTION_NAMES) {
      const value = this.smoothed[name];
      if (value > best) {
        secondBest = best;
        best = value;
        dominant = name;
      } else if (value > secondBest) {
        secondBest = value;
      }
    }
    return { scores: { ...this.smoothed }, dominant, confidence: Math.max(0, Math.min(1, best - Math.max(0, secondBest))) };
  }

  reset() {
    this.smoothed = null;
  }
}
