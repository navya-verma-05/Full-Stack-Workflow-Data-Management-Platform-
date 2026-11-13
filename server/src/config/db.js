import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

export async function connectDB(uri = env.MONGODB_URI, options = {}) {
  mongoose.set("strictQuery", true);
  const defaultOptions = {
    serverSelectionTimeoutMS: env.NODE_ENV === "test" ? 5000 : 10000,
  };
  await mongoose.connect(uri, { ...defaultOptions, ...options });
  logger.info(
    { host: mongoose.connection.host, name: mongoose.connection.name },
    "Connected to MongoDB",
  );
  return mongoose.connection;
}

export async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
    logger.info("Disconnected from MongoDB");
  }
}
