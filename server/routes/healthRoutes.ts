import { Router } from "express";
import { config } from "../config/env";

const router = Router();
router.get("/health", (_req, res) => res.json({
  success: true,
  service: "face-auth-api",
  dependencies: {
    mongoConfigured: Boolean(config.mongoUri),
    aiConfigured: Boolean(config.pythonAiUrl),
  },
}));
export default router;
