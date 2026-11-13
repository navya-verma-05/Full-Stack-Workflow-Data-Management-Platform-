# Performance Benchmarks & Capacity Analysis

This document records the empirical latency and throughput characteristics of the **Workflow Platform** API and ingestion pipeline, measured on local hardware under realistic conditions.

---

## 1. Test Environment & Hardware Specification

All benchmarks were executed directly against the live server instance running on the host workstation:

| Property | Value |
|---|---|
| **Operating System** | Windows 11 Pro (build 10.0.26300, x64) |
| **CPU Model** | 12th Gen Intel(R) Core(TM) i7-12700H (20 virtual cores, 14 physical cores) |
| **Memory** | 16.78 GB Physical RAM |
| **Node.js Runtime** | `v24.19.0` |
| **Database Engine** | MongoDB Community Server (standalone local instance on `127.0.0.1:27017`) |
| **Network Layer** | TCP Loopback (`127.0.0.1`) |
| **Process Configuration** | Single Node.js event-loop process (non-clustered) |

---

## 2. Benchmark Results

### A. Health & Liveness Endpoint (`GET /api/health`)

Measures Express framework baseline routing, middleware pipeline, and MongoDB active connection verification.

- **Load Pattern**: 20 concurrent workers over a 3.00-second window
- **Total Requests**: 17,216
- **Throughput**: **5,732.9 req/sec**
- **Latency Distribution**:
  - **p50 (Median)**: `3.07 ms`
  - **p95**: `6.16 ms`
  - **p99**: `10.77 ms`

```
Throughput:  [████████████████████████████████████████] 5,732.9 req/s
Latency p50: 3.07 ms
Latency p95: 6.16 ms
Latency p99: 10.77 ms
```

### B. Full Webhook Ingestion Pipeline (`POST /api/webhooks/:sourceId`)

Measures the complete end-to-end webhook ingestion path:
1. Raw request body byte capture prior to JSON parsing (`express.json({ verify })`).
2. Source lookup in MongoDB by ObjectId.
3. Decrypting the source signing secret at rest using AES-256-GCM (`SIGNING_SECRET_ENCRYPTION_KEY`).
4. Computing HMAC-SHA256 over `timestamp + '.' + rawBody`.
5. Constant-time cryptographic comparison (`crypto.timingSafeEqual`) against replay windows (tolerance 300s).
6. Payload validation against schema specification (Zod).
7. Atomic Event persistence to MongoDB with unique `(sourceId, idempotencyKey)` index check.
8. Returning HTTP `202 Accepted` response envelope.

- **Batch Size**: 150 signed requests
- **Duration**: 2.25 seconds
- **Throughput**: **66.5 req/sec** (sequential per client thread)
- **Latency Distribution**:
  - **p50 (Median)**: `15.42 ms`
  - **p95**: `16.88 ms`
  - **p99**: `19.51 ms`

---

## 3. Rate Limiting & DoS Safeguards

The platform employs three distinct tiers of IP-based rate limiting via `express-rate-limit`:

1. **Authentication Limiter** (`/api/auth/*`):
   - Limit: **30 requests / 15 minutes**
   - Error: `429 AUTH_RATE_LIMITED`
   - Purpose: Mitigates brute-force credential stuffing and token rotation floods.
2. **Standard API Limiter** (`/api/*`):
   - Limit: **300 requests / 15 minutes** (configurable via `RATE_LIMIT_MAX`)
   - Error: `429 RATE_LIMITED`
   - Purpose: Protects operational dashboard endpoints from runaway polling.
3. **Webhook Ingestion Limiter** (`/api/webhooks/*`):
   - Limit: **1,000 requests / 1 minute** (configurable via `WEBHOOK_RATE_LIMIT_MAX`)
   - Error: `429 WEBHOOK_RATE_LIMITED`
   - Purpose: Dampens runaway webhook floods before database write saturations occur.

During empirical verification, bursts exceeding 1,000 requests within a 60-second window returned HTTP 429 and recovered automatically once the rolling 1-minute window elapsed.

---

## 4. Key Performance Observations & Bottleneck Analysis

1. **HMAC Cryptographic Verification Overhead**:
   AES-256-GCM secret decryption and HMAC-SHA256 hashing run synchronously via Node.js native `crypto`. At p50, crypto verification contributes ~0.8ms of CPU time per request.
2. **MongoDB Write Latency**:
   The primary latency contributor in webhook ingestion is the MongoDB single-document write and index update (`events` collection index on `sourceId_1_idempotencyKey_1` and compound status indexes). Local NVMe disk writes yielded ~12-14ms per document write.
3. **Horizontal Scaling Implications**:
   Because the worker claims jobs atomically via `findOneAndUpdate({ status: 'valid' | 'failed', nextRetryAt: { $lte: now } })`, scaling the ingestion tier horizontally behind an NGINX/ALB reverse proxy requires zero changes to the application code.

