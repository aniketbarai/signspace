import type { Request, Response } from "express";
import { connectDatabase, DatabaseError } from "../config/database";
import { config } from "../config/env";
import { User } from "../models/User";
import { FaceServiceError, cosineSimilarity, generateEmbedding } from "../services/faceService";
import { clearSessionCookie, setSessionCookie } from "../services/session";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type AuthBody = { name?: unknown; email?: unknown; image?: unknown; images?: unknown };

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function safeUser(user: { _id: unknown; name: string; email: string; createdAt?: Date }) {
  return { id: String(user._id), name: user.name, email: user.email, createdAt: user.createdAt };
}

function decodeImage(value: unknown) {
  if (typeof value !== "string") throw new Error("Please capture a face image");
  const match = value.match(/^data:image\/(jpeg|jpg|png|webp);base64,(.+)$/i);
  if (!match) throw new Error("Please provide a valid camera image");
  const image = Buffer.from(match[2], "base64");
  if (image.length < 100 || image.length > MAX_IMAGE_BYTES) throw new Error("The captured image is invalid or too large");
  return image;
}

function decodeImages(value: unknown) {
  if (!Array.isArray(value) || value.length < 3 || value.length > 5) throw new Error("Please capture three face frames");
  return value.map(decodeImage);
}

function averageEmbeddings(embeddings: number[][]) {
  const length = embeddings[0]?.length ?? 0;
  if (!length || embeddings.some((embedding) => embedding.length !== length)) throw new FaceServiceError("Face frames could not be combined reliably");
  const average = Array.from({ length }, (_, index) => embeddings.reduce((sum, embedding) => sum + embedding[index], 0) / embeddings.length);
  const magnitude = Math.sqrt(average.reduce((sum, value) => sum + value ** 2, 0));
  return magnitude === 0 ? average : average.map((value) => value / magnitude);
}

export async function register(req: Request, res: Response) {
  const body = req.body as AuthBody;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = normalizeEmail(body.email);

  if (name.length < 2) return res.status(400).json({ success: false, message: "Enter your full name" });
  if (name.length > 120) return res.status(400).json({ success: false, message: "Name is too long" });
  if (!emailPattern.test(email)) return res.status(400).json({ success: false, message: "Enter a valid email address" });

  try {
    await connectDatabase();
    const existing = await User.findOne({ email }).select("_id").lean();
    if (existing) return res.status(409).json({ success: false, message: "An account already exists for this email" });

    const images = decodeImages(body.images);
    const embeddings = await Promise.all(images.map((image) => generateEmbedding(image)));
    const embedding = averageEmbeddings(embeddings);
    const user = await User.create({ name, email, faceEmbedding: embedding });
    return res.status(201).json({ success: true, message: "Face registered successfully", user: safeUser(user) });
  } catch (error) {
    if (error instanceof FaceServiceError) return res.status(422).json({ success: false, message: error.message });
    if (error instanceof DatabaseError) return res.status(503).json({ success: false, message: error.message });
    if (error instanceof Error && ["Please capture a face image", "Please capture three face frames", "Please provide a valid camera image", "The captured image is invalid or too large"].includes(error.message)) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if ((error as { code?: number })?.code === 11000) return res.status(409).json({ success: false, message: "An account already exists for this email" });
    console.error("[Auth] Registration failed", error instanceof Error ? error.message : error);
    return res.status(503).json({ success: false, message: "Registration is temporarily unavailable. Please try again." });
  }
}

export async function login(req: Request, res: Response) {
  const body = req.body as AuthBody;
  const email = normalizeEmail(body.email);
  if (!emailPattern.test(email)) return res.status(400).json({ success: false, message: "Enter a valid email address" });

  try {
    await connectDatabase();
    const user = await User.findOne({ email }).select("+faceEmbedding");
    if (!user) return res.status(404).json({ success: false, message: "No account found for this email" });

    const image = decodeImage(body.image);
    const candidate = await generateEmbedding(image);
    const similarity = cosineSimilarity(candidate, user.faceEmbedding);
    if (similarity < config.faceMatchThreshold) {
      return res.status(401).json({ success: false, message: "Face not recognized. Make sure you are using the registered face." });
    }

    setSessionCookie(res, String(user._id));
    return res.json({ success: true, message: "Authentication successful", user: safeUser(user) });
  } catch (error) {
    if (error instanceof FaceServiceError) return res.status(422).json({ success: false, message: error.message });
    if (error instanceof DatabaseError) return res.status(503).json({ success: false, message: error.message });
    if (error instanceof Error && ["Please capture a face image", "Please capture three face frames", "Please provide a valid camera image", "The captured image is invalid or too large"].includes(error.message)) {
      return res.status(400).json({ success: false, message: error.message });
    }
    console.error("[Auth] Login failed", error instanceof Error ? error.message : error);
    return res.status(503).json({ success: false, message: "Authentication is temporarily unavailable. Please try again." });
  }
}

export function logout(_req: Request, res: Response) {
  clearSessionCookie(res);
  return res.json({ success: true });
}

export async function me(req: Request & { authUserId?: string }, res: Response) {
  try {
    await connectDatabase();
    const user = await User.findById(req.authUserId).select("name email createdAt").lean();
    if (!user) return res.status(401).json({ success: false, message: "Session expired" });
    return res.json({ success: true, user: safeUser(user) });
  } catch (error) {
    if (error instanceof DatabaseError) return res.status(503).json({ success: false, message: error.message });
    console.error("[Auth] Session lookup failed", error instanceof Error ? error.message : error);
    return res.status(503).json({ success: false, message: "Account information is temporarily unavailable" });
  }
}
