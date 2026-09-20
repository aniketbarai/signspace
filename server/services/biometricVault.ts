import crypto from "crypto";
import { config } from "../config/env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function key() {
  return crypto.createHash("sha256").update(config.jwtSecret).digest();
}

export function encryptEmbeddings(embeddings: number[][]) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key(), iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(embeddings), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decryptEmbeddings(value: string) {
  const payload = Buffer.from(value, "base64");
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = payload.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key(), iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  const decoded = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
  const embeddings = JSON.parse(decoded) as unknown;
  if (!Array.isArray(embeddings) || embeddings.some((embedding) => !Array.isArray(embedding))) {
    throw new Error("Invalid encrypted biometric template");
  }
  return embeddings.map((embedding) => embedding.map(Number));
}
