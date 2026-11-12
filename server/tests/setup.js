import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set test environment variables before importing any application config
process.env.NODE_ENV = 'test';
process.env.PORT = '4000';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/workflow_platform_test';
process.env.CLIENT_ORIGIN = 'http://localhost:5173';
process.env.JWT_ACCESS_SECRET = 'test-access-secret-key-at-least-32-characters-long';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-key-at-least-32-characters-long';
process.env.SIGNING_SECRET_ENCRYPTION_KEY = 'test-signing-encryption-key-at-least-32-chars';
process.env.REQUEST_BODY_LIMIT = '100kb';
process.env.LOG_LEVEL = 'silent';
process.env.MONGOMS_DOWNLOAD_DIR = path.resolve(__dirname, '../.cache/mongodb-binaries');

import { afterAll, afterEach, beforeAll } from 'vitest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  await mongoose.connect(uri);
});

afterEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
});
