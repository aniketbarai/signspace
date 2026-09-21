import type { Request, Response } from "express";
import mongoose from "mongoose";
import { connectDatabase, DatabaseError } from "../config/database";
import { GestureGalleryItem } from "../models/GestureGalleryItem";

type AuthRequest = Request & { authUserId?: string };
const gestureNames = new Set(["NO_HAND", "OPEN_PALM", "FIST", "POINT", "PINCH", "THUMBS_UP", "VICTORY", "HAND"]);
const MAX_ITEMS_PER_USER = 60;
const MAX_THUMBNAIL_CHARS = 60_000; // ~45KB PNG data URL — plenty for a small preview

function userId(req: AuthRequest) {
  if (!req.authUserId) throw new Error("Authentication required");
  return req.authUserId;
}

function sendDbError(res: Response, error: unknown, fallback: string) {
  if (error instanceof DatabaseError) return res.status(503).json({ success: false, message: error.message, code: error.code });
  return res.status(503).json({ success: false, message: fallback });
}

export async function listGallery(req: AuthRequest, res: Response) {
  try {
    await connectDatabase();
    const items = await GestureGalleryItem.find({ userId: userId(req) })
      .select("title thumbnail createdAt updatedAt")
      .sort({ createdAt: -1 })
      .limit(MAX_ITEMS_PER_USER)
      .lean();
    return res.json({ success: true, items });
  } catch (error) {
    return sendDbError(res, error, "Your saved work is temporarily unavailable");
  }
}

export async function getGalleryItem(req: AuthRequest, res: Response) {
  try {
    await connectDatabase();
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid item id" });
    const item = await GestureGalleryItem.findOne({ _id: id, userId: userId(req) }).lean();
    if (!item) return res.status(404).json({ success: false, message: "Saved work not found" });
    return res.json({ success: true, item });
  } catch (error) {
    return sendDbError(res, error, "Could not load this saved work");
  }
}

export async function createGalleryItem(req: AuthRequest, res: Response) {
  try {
    await connectDatabase();
    const owner = userId(req);
    const body = req.body ?? {};

    const count = await GestureGalleryItem.countDocuments({ userId: owner });
    if (count >= MAX_ITEMS_PER_USER) {
      return res.status(409).json({ success: false, message: `You've reached the limit of ${MAX_ITEMS_PER_USER} saved drawings. Delete one to save a new one.` });
    }

    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim().slice(0, 80) : "Untitled";
    const thumbnail = typeof body.thumbnail === "string" ? body.thumbnail.slice(0, MAX_THUMBNAIL_CHARS) : "";
    const strokes = Array.isArray(body.strokes)
      ? body.strokes.slice(0, 300).map((stroke: any) => ({
          points: Array.isArray(stroke?.points)
            ? stroke.points.slice(0, 1200).map((point: any) => [Number(point?.[0]), Number(point?.[1])]).filter((point: number[]) => point.every(Number.isFinite))
            : [],
          color: typeof stroke?.color === "string" ? stroke.color.slice(0, 20) : "#e76e43",
          width: Math.min(40, Math.max(1, Number(stroke?.width) || 6)),
        }))
      : [];
    const transcript = Array.isArray(body.transcript)
      ? body.transcript.filter((item: unknown): item is string => typeof item === "string" && gestureNames.has(item)).slice(-100)
      : [];
    const lastGesture = typeof body.lastGesture === "string" && gestureNames.has(body.lastGesture) ? body.lastGesture : "NO_HAND";

    if (strokes.length === 0) return res.status(400).json({ success: false, message: "Draw something before saving it to your gallery" });

    const item = await GestureGalleryItem.create({ userId: owner, title, thumbnail, strokes, transcript, lastGesture });
    return res.status(201).json({ success: true, item });
  } catch (error) {
    return sendDbError(res, error, "Could not save this drawing to your gallery");
  }
}

export async function deleteGalleryItem(req: AuthRequest, res: Response) {
  try {
    await connectDatabase();
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid item id" });
    const result = await GestureGalleryItem.deleteOne({ _id: id, userId: userId(req) });
    if (result.deletedCount === 0) return res.status(404).json({ success: false, message: "Saved work not found" });
    return res.json({ success: true });
  } catch (error) {
    return sendDbError(res, error, "Could not delete this saved work");
  }
}
