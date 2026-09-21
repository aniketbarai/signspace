import mongoose, { InferSchemaType } from "mongoose";

const gestureWorkSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
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
    updatedAt: { type: Date, default: Date.now },
  },
  { versionKey: false }
);

export type GestureWorkDocument = InferSchemaType<typeof gestureWorkSchema> & { _id: mongoose.Types.ObjectId };
export const GestureWork = mongoose.models.GestureWork || mongoose.model("GestureWork", gestureWorkSchema);
