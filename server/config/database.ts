import mongoose from "mongoose";
import { config } from "./env";

let connectionPromise: Promise<typeof mongoose> | null = null;

export class DatabaseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DatabaseError";
  }
}

export async function connectDatabase() {
  if (!config.mongoUri) {
    throw new DatabaseError("MongoDB is not configured. Add MONGO_URI to the project environment.");
  }

  if (mongoose.connection.readyState === 1) return mongoose;
  if (!connectionPromise) {
    connectionPromise = mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
      maxPoolSize: 10,
    }).catch(() => {
      connectionPromise = null;
      throw new DatabaseError("MongoDB is unavailable. Check MONGO_URI and MongoDB connectivity.");
    });
  }

  return connectionPromise;
}
