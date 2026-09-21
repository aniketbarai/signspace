import { Router } from "express";
import { getWork, recognize, saveWork } from "../controllers/gestureController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();
router.use(requireAuth);
router.post("/recognize", recognize);
router.get("/work", getWork);
router.put("/work", saveWork);
export default router;
