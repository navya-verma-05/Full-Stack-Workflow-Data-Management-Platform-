import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set test environment variables before importing any application config
process.env.NODE_ENV = "test";
process.env.PORT = "4000";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/workflow_platform_test";
process.env.CLIENT_ORIGIN = "http://localhost:5173";
process.env.JWT_ACCESS_SECRET =
  "test-access-secret-key-at-least-32-characters-long";
process.env.JWT_REFRESH_SECRET =
  "test-refresh-secret-key-at-least-32-characters-long";
process.env.SIGNING_SECRET_ENCRYPTION_KEY =
  "test-signing-encryption-key-at-least-32-chars";
process.env.BOOTSTRAP_TOKEN = "test-bootstrap-token-one-time-secret";
process.env.REQUEST_BODY_LIMIT = "100kb";
process.env.RETRY_BASE_DELAY_MS = "25";
process.env.RETRY_MAX_ATTEMPTS = "3";
process.env.LOG_LEVEL = "silent";
process.env.MONGOMS_DOWNLOAD_DIR = path.resolve(
  __dirname,
  "../.cache/mongodb-binaries",
);

import { afterAll, afterEach, beforeAll } from "vitest";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongod;

/**
 * Returns an explicit URI for the isolated in-memory test database.
 * @param {string} dbName - Target database name (defaults to 'workflow_platform_test')
 * @returns {string} MongoDB connection URI pointing strictly to MongoMemoryServer
 */
export function getTestMongoUri(dbName = "workflow_platform_test") {
  if (!mongod) {
    throw new Error(
      "MongoMemoryServer is not running or has not been initialized yet",
    );
  }
  return mongod.getUri(dbName);
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri("workflow_platform_test");
  process.env.MONGODB_URI = uri;
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });
});

afterEach(async () => {
  if (mongoose.connection.readyState === 1) {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) {
      await collections[key].deleteMany({});
    }
  }
});

afterAll(async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
  }
});
