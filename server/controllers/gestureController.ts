import type { Request, Response } from "express";
import { connectDatabase, DatabaseError } from "../config/database";
import { GestureWork } from "../models/GestureWork";
import { HandServiceError, recognizeGesture } from "../services/handService";

type AuthRequest = Request & { authUserId?: string };
const gestureNames = new Set(["NO_HAND", "OPEN_PALM", "FIST", "POINT", "PINCH", "THUMBS_UP", "VICTORY", "HAND"]);

function userId(req: AuthRequest) {
  if (!req.authUserId) throw new Error("Authentication required");
  return req.authUserId;
}

export async function recognize(req: AuthRequest, res: Response) {
  try {
    const image = req.body?.image;
    if (typeof image !== "string" || image.length < 100) return res.status(400).json({ success: false, message: "Capture a hand image first" });
    const result = await recognizeGesture(image);
    return res.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof HandServiceError) return res.status(422).json({ success: false, message: error.message });
    return res.status(503).json({ success: false, message: "Hand recognition is temporarily unavailable" });
  }
}

export async function getWork(req: AuthRequest, res: Response) {
  try {
    await connectDatabase();
    const work = await GestureWork.findOne({ userId: userId(req) }).lean();
    return res.json({ success: true, work: work ?? { strokes: [], transcript: [], lastGesture: "NO_HAND" } });
  } catch (error) {
    if (error instanceof DatabaseError) return res.status(503).json({ success: false, message: error.message, code: error.code });
    return res.status(503).json({ success: false, message: "Gesture work is temporarily unavailable" });
  }
}

export async function saveWork(req: AuthRequest, res: Response) {
  try {
    await connectDatabase();
    const body = req.body ?? {};
    const strokes = Array.isArray(body.strokes) ? body.strokes.slice(0, 300).map((stroke: any) => ({
      points: Array.isArray(stroke?.points) ? stroke.points.slice(0, 1200).map((point: any) => [Number(point?.[0]), Number(point?.[1])]).filter((point: number[]) => point.every(Number.isFinite)) : [],
      color: typeof stroke?.color === "string" ? stroke.color.slice(0, 20) : "#e76e43",
      width: Math.min(40, Math.max(1, Number(stroke?.width) || 6)),
    })) : [];
    const transcript = Array.isArray(body.transcript) ? body.transcript.filter((item: unknown): item is string => typeof item === "string" && gestureNames.has(item)).slice(-100) : [];
    const lastGesture = typeof body.lastGesture === "string" && gestureNames.has(body.lastGesture) ? body.lastGesture : "NO_HAND";
    const work = await GestureWork.findOneAndUpdate(
      { userId: userId(req) },
      { $set: { strokes, transcript, lastGesture, updatedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
    return res.json({ success: true, work });
  } catch (error) {
    if (error instanceof DatabaseError) return res.status(503).json({ success: false, message: error.message, code: error.code });
    return res.status(503).json({ success: false, message: "Gesture work could not be saved" });
  }
}
