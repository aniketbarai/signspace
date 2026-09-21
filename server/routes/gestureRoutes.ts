import { Router } from "express";
import { getWork, recognize, saveWork } from "../controllers/gestureController";
import { createGalleryItem, deleteGalleryItem, getGalleryItem, listGallery } from "../controllers/galleryController";
import { requireAuth } from "../middleware/authMiddleware";

const router = Router();
router.use(requireAuth);
router.post("/recognize", recognize);
router.get("/work", getWork);
router.put("/work", saveWork);

// Gallery: multiple named, thumbnailed saves per user (separate from the single autosaved draft above).
router.get("/gallery", listGallery);
router.post("/gallery", createGalleryItem);
router.get("/gallery/:id", getGalleryItem);
router.delete("/gallery/:id", deleteGalleryItem);

export default router;
