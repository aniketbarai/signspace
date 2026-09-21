import mongoose from "mongoose";
import { config } from "./env";

let connectionPromise: Promise<typeof mongoose> | null = null;

export class DatabaseError extends Error {
  code: "DB_NOT_CONFIGURED" | "DB_UNAVAILABLE";
  constructor(message: string, code: "DB_NOT_CONFIGURED" | "DB_UNAVAILABLE") {
    super(message);
    this.name = "DatabaseError";
    this.code = code;
  }
}

export async function connectDatabase() {
  if (!config.mongoUri) {
    throw new DatabaseError(
      "Server storage isn't configured. Set MONGO_URI in the environment to persist saved work across devices.",
      "DB_NOT_CONFIGURED"
    );
  }

  if (mongoose.connection.readyState === 1) return mongoose;
  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(config.mongoUri, {
        serverSelectionTimeoutMS: 5000,
        maxPoolSize: 10,
      })
      .catch((cause) => {
        connectionPromise = null;
        console.error("[Database] MongoDB connection failed:", cause instanceof Error ? cause.message : cause);
        throw new DatabaseError("MongoDB is unavailable. Check MONGO_URI and MongoDB connectivity.", "DB_UNAVAILABLE");
      });
  }

  return connectionPromise;
}
