import { describe, expect, it } from "vitest";
import { cosineSimilarity } from "./faceService";

describe("cosineSimilarity", () => {
  it("returns 1 for identical normalized embeddings", () => {
    expect(cosineSimilarity([0.6, 0.8], [0.6, 0.8])).toBeCloseTo(1, 5);
  });

  it("returns 0 for orthogonal embeddings", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 5);
  });

  it("rejects embeddings with different dimensions", () => {
    expect(cosineSimilarity([1, 0], [1, 0, 0])).toBe(-1);
  });

  it("returns a negative score for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 5);
  });
});
