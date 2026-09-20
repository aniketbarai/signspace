import { Router } from "express";
import { me } from "../controllers/authController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();
router.get("/me", requireAuth, me);
export default router;
