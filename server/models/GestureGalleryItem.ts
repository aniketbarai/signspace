import mongoose, { InferSchemaType } from "mongoose";

const gestureGalleryItemSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, default: "Untitled", trim: true, maxlength: 80 },
    thumbnail: { type: String, default: "" }, // small PNG data URL, capped in the controller
    strokes: {
      type: [
        {
          points: { type: [[Number]], default: [] },
          color: { type: String, default: "#e76e43" },
          width: { type: Number, default: 6, min: 1, max: 40 },
        },
      ],
      default: [],
    },
    transcript: { type: [String], default: [] },
    lastGesture: { type: String, default: "NO_HAND" },
  },
  { versionKey: false, timestamps: true }
);

gestureGalleryItemSchema.index({ userId: 1, createdAt: -1 });

export type GestureGalleryItemDocument = InferSchemaType<typeof gestureGalleryItemSchema> & { _id: mongoose.Types.ObjectId };
export const GestureGalleryItem = mongoose.models.GestureGalleryItem || mongoose.model("GestureGalleryItem", gestureGalleryItemSchema);
