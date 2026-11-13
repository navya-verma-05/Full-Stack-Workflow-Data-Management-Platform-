import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from '../server/node_modules/mongoose/index.js';
import { assertSafeDatabase } from '../server/src/utils/dbGuard.js';
import { encryptSecret } from '../server/src/utils/crypto.js';
import { createApp } from '../server/src/app.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvValue(key) {
  if (process.env[key]) return process.env[key];
  const envPath = path.resolve(__dirname, '../server/.env');
  if (!fs.existsSync(envPath)) return undefined;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    if (k === key) return v;
  }
  return undefined;
}

// Data Safety: Target database defaults to workflow_platform_perf, NEVER workflow_platform
const TARGET_DB_URI =
  process.env.PERF_MONGODB_URI ||
  process.env.TEST_MONGODB_URI ||
  'mongodb://127.0.0.1:27017/workflow_platform_perf';

export async function runPerformanceBenchmark({
  mongoUri = TARGET_DB_URI,
  iterations = 30,
  concurrency = 5,
} = {}) {
  // CRITICAL GUARD: Ensure we never touch workflow_platform (must end in _perf or _test)
  assertSafeDatabase(mongoUri, 'performance benchmark');

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  console.log(`[PERF] Connecting to isolated database: ${mongoUri}`);
  await mongoose.connect(mongoUri);

  let tempSourceId;
  const rawSecret = 'perf-secret-32-chars-long-123456';
  let server = null;
  let serverPort = null;

  try {
    // 1. Prepare isolated source collection
    const sourcesCol = mongoose.connection.collection('sources');
    const eventsCol = mongoose.connection.collection('events');

    await eventsCol.createIndex({ sourceId: 1, idempotencyKey: 1 }, { unique: true });

    const insertResult = await sourcesCol.insertOne({
      name: 'Perf Test Source',
      description: 'Temporary source for isolated performance benchmark',
      schemaType: 'web_form',
      apiKeyPrefix: 'wpk_perf12',
      apiKeyHash: crypto.createHash('sha256').update('perf-api-key').digest('hex'),
      signingSecretHash: crypto.createHash('sha256').update(rawSecret).digest('hex'),
      signingSecretEncrypted: encryptSecret(rawSecret),
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    tempSourceId = insertResult.insertedId;
    console.log(`[PERF] Created temporary source ${tempSourceId}`);

    // 2. Start OWN dedicated server instance on an ephemeral port (NEVER port 4000)
    const app = createApp();
    server = await new Promise((resolve, reject) => {
      const s = app.listen(0, '127.0.0.1', () => resolve(s));
      s.on('error', reject);
    });

    const addr = server.address();
    serverPort = typeof addr === 'object' && addr ? addr.port : null;
    if (!serverPort || serverPort === 4000) {
      throw new Error(`[DATA SAFETY] Perf server must bind to its own ephemeral port, got ${serverPort}`);
    }
    console.log(`[PERF] Started isolated test server on port ${serverPort} (separate from port 4000)`);

    console.log(`[PERF] Executing ${iterations} signed HTTP webhook deliveries with concurrency ${concurrency}...`);

    const latencies = [];
    let completed = 0;
    const t0Total = performance.now();

    async function sendOne(idx) {
      const payload = {
        submissionId: `perf-${Date.now()}-${idx}`,
        fullName: `Perf Lead ${idx}`,
        email: `perf${idx}@test.local`,
        company: 'Perf Corp',
        topic: 'demo_request',
        tags: ['perf', 'load'],
      };
      const rawBody = JSON.stringify(payload);
      const ts = Math.floor(Date.now() / 1000);
      const mac = crypto
        .createHmac('sha256', rawSecret)
        .update(`${ts}.${rawBody}`)
        .digest('hex');

      const t0 = performance.now();
      const res = await fetch(`http://127.0.0.1:${serverPort}/api/webhooks/${tempSourceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-timestamp': String(ts),
          'x-webhook-signature': `sha256=${mac}`,
          'x-idempotency-key': `perf-key-${Date.now()}-${idx}`,
        },
        body: rawBody,
      });

      if (!res.ok && res.status !== 200 && res.status !== 201) {
        throw new Error(`HTTP ${res.status}: ${await res.text()}`);
      }

      latencies.push(performance.now() - t0);
      completed++;
    }

    const queue = Array.from({ length: iterations }, (_, i) => i);
    async function worker() {
      while (queue.length > 0) {
        const item = queue.shift();
        if (item !== undefined) {
          await sendOne(item);
        }
      }
    }

    await Promise.all(Array.from({ length: concurrency }, () => worker()));
    const totalTimeSec = (performance.now() - t0Total) / 1000;

    latencies.sort((a, b) => a - b);
    const p50 = latencies[Math.floor(latencies.length * 0.5)].toFixed(2);
    const p95 = latencies[Math.floor(latencies.length * 0.95)].toFixed(2);
    const p99 = latencies[Math.floor(latencies.length * 0.99)].toFixed(2);
    const rps = (completed / totalTimeSec).toFixed(1);

    const results = {
      database: mongoose.connection.name,
      serverPort,
      totalRequests: completed,
      durationSec: totalTimeSec.toFixed(2),
      throughputRps: Number(rps),
      latencyP50Ms: Number(p50),
      latencyP95Ms: Number(p95),
      latencyP99Ms: Number(p99),
    };

    // Allow pending asynchronous worker kicks to settle
    await new Promise((resolve) => setTimeout(resolve, 200));

    console.log('[PERF] Benchmark Completed:');
    console.table([results]);
    return results;
  } finally {
    // Stop isolated server
    if (server) {
      await new Promise((resolve) => server.close(resolve));
      console.log('[PERF] Stopped isolated test server.');
    }

    // Clean up after itself: drop database completely
    console.log(`[PERF] Cleaning up: dropping database ${mongoose.connection.name}...`);
    try {
      await mongoose.connection.db.dropDatabase();
    } catch (err) {
      console.warn('[PERF] Cleanup dropDatabase warning:', err.message);
    }
    await mongoose.disconnect();
    console.log('[PERF] Cleaned up and disconnected.');
  }
}

// Auto-run if executed directly
if (process.argv[1] && process.argv[1].endsWith('run-perf.js')) {
  runPerformanceBenchmark().catch((err) => {
    console.error('[FATAL]', err.message);
    process.exit(1);
  });
}
