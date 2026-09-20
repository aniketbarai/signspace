import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, logout, register } from "../controllers/authController";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many authentication attempts. Please try again later." },
});

const router = Router();
router.post("/register", authLimiter, register);
router.post("/login", authLimiter, login);
router.post("/logout", logout);
export default router;
