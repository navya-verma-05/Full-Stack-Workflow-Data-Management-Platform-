# Workflow & Data Management Platform

A full-stack webhook ingestion, schema validation, asynchronous retry, and operational telemetry platform built with Node.js, Express, MongoDB/Mongoose, React, TypeScript, Tailwind CSS, and Recharts.

External systems (web forms, CRM integrations, B2B partner order feeds) send signed JSON webhooks to `/api/webhooks/:sourceId`. Every delivery undergoes constant-time HMAC-SHA256 verification over raw bytes, replay-window validation, per-source Zod schema validation, idempotency deduplication, atomic background processing with exponential backoff + dead-lettering, and normalization into client records. Authenticated operators inspect pipelines, troubleshoot failures, replay dead-lettered events, and audit administrative actions through a role-aware React dashboard.

---

## Architecture Overview

```text
  External Source (Web Form / CRM / Partner)
       │  POST /api/webhooks/:sourceId
       │  Headers: x-webhook-signature, x-webhook-timestamp, x-idempotency-key
       ▼
  [ Raw Body Capture + Rate Limiter + Body Limit (100kb) ]
       │
       ├──► Verify HMAC-SHA256 (crypto.timingSafeEqual, ±300s replay guard)
       │    (Source signing secrets encrypted at rest via AES-256-GCM)
       ▼
  [ Persist Event + Enforce Unique Index (sourceId, idempotencyKey) ]
       │
       ├── Schema Invalid ──► Event(status: "invalid", errors[])
       │
       └── Schema Valid   ──► Event(status: "valid", nextRetryAt: now)
                                 │
                                 ▼
                    [ Mongo-Backed Atomic Worker (findOneAndUpdate lock) ]
                       ├── Success ──► Upsert normalized Record + Event("processed")
                       ├── Transient Failure ──► Exponential backoff (1s, 2s, 4s...)
                       └── Max Attempts Exhausted ──► Event("dead_letter") ──► Admin/Manager Replay
```

---

## Key Capabilities & Engineering Decisions

- **Security & Auth**:
  - First-admin bootstrap protected by `SystemLock` race-safe check + one-time `BOOTSTRAP_TOKEN` header (`x-bootstrap-token`); open self-registration is locked thereafter (`admin`-only provisioning).
  - Short-lived JWT access tokens (`15m` default) stored strictly in frontend memory (never `localStorage` or `sessionStorage`).
  - `httpOnly` refresh cookies (`COOKIE_SECURE=true` forced in `production`) backed by hashed `RefreshToken` documents in MongoDB with server-side logout revocation and reuse invalidation.
  - Role-based authorization (`admin`, `manager`, `viewer`) enforced on every non-public API route and reflected in the UI; `viewer` has zero write permissions (`403` on mutations). See [docs/PERMISSIONS.md](./docs/PERMISSIONS.md).
- **Webhook Pipeline & Queue Choice**:
  - Implemented an **atomic Mongo-backed worker** (`Event.findOneAndUpdate` lease locking + `nextRetryAt` scheduling) rather than BullMQ + Redis to avoid a separate Redis runtime dependency while remaining horizontally safe across concurrent workers. The processor and queue claim loop live cleanly in `server/src/jobs/eventWorker.js`.
  - Signing secrets are encrypted at rest with **AES-256-GCM** (`SIGNING_SECRET_ENCRYPTION_KEY`) and revealed once upon source creation or secret rotation. API keys and refresh tokens are hashed with SHA-256.
  - Strict body size ceiling (`100kb` default), explicit max lengths on all Zod (`^4.6.7`) schemas, regex escaping (`escapeRegex`) for partial search, and `$facet` MongoDB aggregations indexed for fast queries. See [docs/INDEXES.md](./docs/INDEXES.md).
- **React + TypeScript Dashboard**:
  - **Overview**: KPI cards with equal-length previous-period deltas (`deltas`), `"Last event received"` indicator, interactive stacked bar chart (clickable status series toggles), **Needs Attention** panel with inline event replay, and optional 30s auto-refresh.
  - **Events & Quick Inspector**: Status filter chips with live counts, custom/preset `DateRangePicker`, compact copyable idempotency keys, right-side slide-over drawer on row click, and `/events/:id` detail view pairing side-by-side normalized records with syntax-highlighted JSON payloads and backoff retry timelines.
  - **Command Palette (`Ctrl+K` / `Cmd+K`)**: Role-aware page navigation, live event lookup, and light/dark theme switching (only `workflow_theme` persists in `localStorage`).

---

## Monorepo Structure

```text
workflow-platform/
├── .github/workflows/ci.yml   # GitHub Actions CI (server + client lint, test, build)
├── client/                    # React + TypeScript + Vite + Tailwind + Vitest dashboard
├── server/                    # Express + Mongoose API, webhook worker, seed script, Vitest suites
│   └── scripts/seed.js        # Deterministic seeded incident + 259-event dataset
├── scripts/
│   └── simulate-webhooks.js   # Sends signed live webhooks across 3 sources + failure/duplicate cases
├── docs/
│   ├── PERMISSIONS.md         # Route-by-role permissions matrix generated from route code
│   └── INDEXES.md             # MongoDB index inventory, aggregation notes, and explain() plans
└── package.json               # Root convenience workspace scripts
```

---

## Prerequisites & Environment Setup

- **Node.js** `20+` (verified on `v24.19.0`)
- **MongoDB Community / Atlas** reachable via `MONGODB_URI` (local default: `mongodb://127.0.0.1:27017/workflow_platform`)

1. Install dependencies:
   ```powershell
   npm --prefix server install
   npm --prefix client install
   ```

2. Configure environment variables:
   - Copy `server/.env.example` to `server/.env` and replace every `CHANGE_ME...` placeholder (`MONGODB_URI`, 32+ char `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `SIGNING_SECRET_ENCRYPTION_KEY`, and 16+ char `BOOTSTRAP_TOKEN`).
   - Copy `client/.env.example` to `client/.env` (`VITE_API_URL=/api`).

---

## Running Locally

### 1. Seed Sample Data (Incident + 14-Day Telemetry)

No passwords are hardcoded in source. Set `SEED_ADMIN_PASSWORD` / `SEED_MANAGER_PASSWORD` / `SEED_VIEWER_PASSWORD` in your shell or let the seed script generate random passwords and print them once:

```powershell
npm --prefix server run seed -- --reset
```

This seeds 3 users (`admin`, `manager`, `viewer`), 3 webhook sources (`Web Form Leads`, `CRM Deals`, `Partner Orders`), 259 events (including a 2-day outage spike and recovery on Partner Orders), 191 normalized records, and 6 audit logs.

### 2. Start Backend & Frontend

Run in two terminals from the repository root:

```powershell
# Terminal 1 — Backend API + retry worker (http://localhost:4000)
npm --prefix server run dev
```

```powershell
# Terminal 2 — React + Vite dashboard (http://localhost:5173, proxies /api -> :4000)
npm --prefix client run dev
```

Open **http://localhost:5173** and sign in with the printed `admin@workflow.local` or `viewer@workflow.local` credentials.

### 3. Simulate Live Signed Webhooks

With the backend server running, test live ingestion (valid payloads across 3 schemas, malformed schema payload, invalid HMAC signature, duplicate idempotency delivery, and simulated transient downstream failure -> exponential backoff retry -> success):

```powershell
$env:ADMIN_EMAIL="admin@workflow.local"
$env:ADMIN_PASSWORD="<your-seeded-or-created-admin-password>"
node scripts/simulate-webhooks.js
```

---

## Testing, Linting & Security Audits

All checks can be run from the root or individual packages:

| Check | Command | Verified Result |
| --- | --- | --- |
| Server unit & integration tests (`mongodb-memory-server` + Supertest) | `npm --prefix server test` | **6 test files, 28/28 tests passed** |
| Client tests (Vitest + Testing Library) | `npm --prefix client test` | **1 test file, 4/4 tests passed** |
| Client TypeScript & Vite production build | `npm --prefix client run build` | Passed (`tsc -b && vite build`) |
| ESLint (`server/` and `client/`) | `npm run lint` | **0 errors** |
| Runtime dependency audit (`server/` and `client/`) | `npm --prefix server audit --omit=dev` / `client` | **0 vulnerabilities** |

- **Remaining dev-only audit notes** (test/lint tooling only, excluded from runtime deployments): `vitest` / `@vitest/coverage-v8` (`tinypool`, `@vitest/mocker`, `glob`/`minimatch`) and `typescript-eslint`. Never use `npm audit fix --force`.

---

## License

[MIT](./LICENSE)
