import type { Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config/env";

// 400 days is the practical ceiling: Chrome (and the Cookie spec's guidance)
// caps a cookie's Max-Age there regardless of what a server asks for. Paired
// with the rolling renewal in authMiddleware (every authenticated request
// reissues the cookie with a fresh 400-day window), a user who keeps using
// the app effectively never gets logged out — only an explicit "Log out"
// clears the cookie, or 400 days of total inactivity.
export const SESSION_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;
export const SESSION_MAX_AGE_JWT = "400d";

export function setSessionCookie(res: Response, userId: string) {
  const token = jwt.sign({ sub: userId }, config.jwtSecret, { expiresIn: SESSION_MAX_AGE_JWT });
  res.cookie(config.authCookieName, token, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE_MS,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(config.authCookieName, {
    httpOnly: true,
    secure: config.nodeEnv === "production",
    sameSite: "lax",
    path: "/",
  });
}
