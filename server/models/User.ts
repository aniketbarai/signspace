import mongoose, { InferSchemaType } from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    faceEmbedding: {
      type: [Number],
      required: true,
      select: false,
      validate: {
        validator: (value: number[]) => value.length > 0 && value.length <= 2048,
        message: "Invalid face embedding",
      },
    },
  },
  { timestamps: true, versionKey: false }
);

export type UserDocument = InferSchemaType<typeof userSchema> & { _id: mongoose.Types.ObjectId };
export const User = mongoose.models.User || mongoose.model("User", userSchema);
