import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";

export type AuthenticatedRequest = Request & { authUserId?: string };

type AuthPayload = { sub: string; iat?: number; exp?: number };

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[config.authCookieName];
  if (!token) {
    return res.status(401).json({ success: false, message: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
    if (!payload.sub) throw new Error("Missing subject");
    req.authUserId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: "Session expired. Please authenticate again." });
  }
}
