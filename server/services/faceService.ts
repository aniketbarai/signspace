import axios from "axios";
import { config } from "../config/env";

export class FaceServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FaceServiceError";
  }
}

export async function generateEmbedding(imageBuffer: Buffer) {
  try {
    const response = await axios.post(
      `${config.pythonAiUrl.replace(/\/$/, "")}/generate-embedding`,
      { image: imageBuffer.toString("base64") },
      {
        timeout: 15000,
        maxContentLength: 6 * 1024 * 1024,
        maxBodyLength: 6 * 1024 * 1024,
      }
    );

    const data = response.data as { success?: boolean; embedding?: unknown; message?: string };
    if (!data.success || !Array.isArray(data.embedding) || data.embedding.length === 0) {
      throw new FaceServiceError(data.message || "Unable to generate a face embedding");
    }

    const embedding = data.embedding.map(Number);
    if (embedding.some((value) => !Number.isFinite(value))) {
      throw new FaceServiceError("The face service returned an invalid embedding");
    }
    return embedding;
  } catch (error) {
    if (error instanceof FaceServiceError) throw error;
    if (axios.isAxiosError(error)) {
      if (!error.response) throw new FaceServiceError("Face AI service is unavailable");
      const message = (error.response.data as { message?: string } | undefined)?.message;
      throw new FaceServiceError(message || "Face AI service could not process this image");
    }
    throw new FaceServiceError("Face embedding generation failed");
  }
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || a.length === 0) return -1;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let index = 0; index < a.length; index += 1) {
    dot += a[index] * b[index];
    normA += a[index] ** 2;
    normB += b[index] ** 2;
  }
  if (normA === 0 || normB === 0) return -1;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
