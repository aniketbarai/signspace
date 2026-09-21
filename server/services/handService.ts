import axios from "axios";
import { config } from "../config/env";

export type HandLandmark = { x: number; y: number; z: number };
export type GestureResult = {
  gesture: string;
  confidence: number;
  landmarks: HandLandmark[];
  handedness: string | null;
};

export class HandServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "HandServiceError";
  }
}

export async function recognizeGesture(image: string): Promise<GestureResult> {
  try {
    const response = await axios.post(
      `${config.pythonAiUrl.replace(/\/$/, "")}/recognize-gesture`,
      { image: image.replace(/^data:image\/[^;]+;base64,/, "") },
      { timeout: 15000, maxContentLength: 6 * 1024 * 1024, maxBodyLength: 6 * 1024 * 1024 }
    );
    const data = response.data as Partial<GestureResult> & { success?: boolean; message?: string };
    if (!data.success) throw new HandServiceError(data.message || "Hand recognition failed");
    if (typeof data.gesture !== "string" || !Array.isArray(data.landmarks)) {
      throw new HandServiceError("The hand service returned an invalid result");
    }
    return {
      gesture: data.gesture,
      confidence: Number(data.confidence ?? 0),
      landmarks: data.landmarks.map(point => ({ x: Number(point.x), y: Number(point.y), z: Number(point.z) })),
      handedness: data.handedness ?? null,
    };
  } catch (error) {
    if (error instanceof HandServiceError) throw error;
    if (axios.isAxiosError(error)) {
      if (!error.response) throw new HandServiceError("Hand AI service is unavailable");
      const body = error.response.data as { message?: string; detail?: string } | undefined;
      const message = body?.message || body?.detail;
      if (message && message !== "Internal Server Error") throw new HandServiceError(message);
      if (error.response.status === 413) throw new HandServiceError("The captured hand image is too large");
      if (error.response.status === 422) throw new HandServiceError("The hand image request is invalid");
      if (error.response.status >= 500) throw new HandServiceError("Hand AI service failed while processing the image");
      throw new HandServiceError("Hand AI service could not process this image");
    }
    throw new HandServiceError("Hand recognition failed");
  }
}
