# workflow-platform

A full-stack workflow and data management platform for ingesting, validating, normalizing, and monitoring structured client data from external webhook sources with role-based access control.

> **Status:** Initialized (Phase 0 — Environment & Monorepo Layout). Documentation, architecture diagrams, and operational guides will be completed across subsequent phases.

## Monorepo Structure

- `server/` — Node.js + Express + Mongoose backend API, webhook ingestion pipeline, retry worker, and tests
- `client/` — React + TypeScript + Vite dashboard UI and tests
- `docs/` — Permissions matrix, performance notes, and design documentation
- `scripts/` — Operational & simulation scripts (e.g., `simulate-webhooks.js`)

## Dependency Audit Notes

- Production runtime (`npm audit --omit=dev`): **0 vulnerabilities** in both `server/` and `client/` (`zod@4.6.7`).
- Remaining **dev-only** findings (not included in production builds):
  - `server/` (7 dev-only: 5 moderate, 2 critical): `vitest` (`tinypool`, `@vitest/mocker`), `@vitest/coverage-v8` (`test-exclude`, `glob`, `minimatch`).
  - `client/` (13 dev-only: 11 moderate, 2 critical): `vitest` (`tinypool`, `@vitest/mocker`), `@vitest/coverage-v8` (`test-exclude`, `glob`, `minimatch`), and `typescript-eslint` (`@typescript-eslint/*` via `minimatch`).

