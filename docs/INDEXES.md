# MongoDB Indexes & `explain()` Query Plans

## Index Inventory & Rationale

| Collection | Index Definition | Purpose |
| --- | --- | --- |
| `users` | `{ email: 1 }` (`unique: true`) | Enforces one account per email and makes login lookups O(log N). |
| `users` | `{ role: 1, active: 1 }` | Optimizes admin user-management filtering by role and active status. |
| `refreshtokens` | `{ tokenHash: 1 }` (`unique: true`) | O(log N) lookup of refresh tokens on `/api/auth/refresh` and `/api/auth/logout`. |
| `refreshtokens` | `{ userId: 1, revokedAt: 1 }` | Fast revocation of all active sessions on reuse detection. |
| `refreshtokens` | `{ expiresAt: 1 }` (`expireAfterSeconds: 0`) | TTL index auto-purges expired refresh tokens. |
| `sources` | `{ name: 1 }` (`unique: true`) | Prevents duplicate source names. |
| `sources` | `{ active: 1 }` | Filters active webhook sources. |
| `events` | `{ sourceId: 1, idempotencyKey: 1 }` (`unique: true`) | Enforces idempotent webhook delivery per source at the DB layer. |
| `events` | `{ status: 1, receivedAt: -1 }` | Powers status-filtered event lists sorted newest-first without in-memory sorts. |
| `events` | `{ sourceId: 1, receivedAt: -1 }` | Powers per-source event filtering and per-source dashboard aggregations. |
| `events` | `{ status: 1, nextRetryAt: 1, processingLockUntil: 1 }` | Supports atomic `findOneAndUpdate` job claims by the Mongo-backed retry worker. |
| `events` | `{ receivedAt: -1 }` | Optimizes global chronological event pagination and date-range scans. |
| `records` | `{ eventId: 1 }` (`unique: true`) | Guarantees a 1-to-1 relationship between a valid `Event` and its normalized `Record`. |
| `records` | `{ sourceId: 1, createdAt: -1 }` | Optimizes per-source record pagination. |
| `records` | `{ clientEmail: 1 }` | Speeds up client email lookups. |
| `records` | `{ clientName: "text", clientEmail: "text", company: "text", externalId: "text" }` | Text index for full-word search across normalized records. |
| `auditlogs` | `{ createdAt: -1 }` | Reverse-chronological audit log pagination. |
| `auditlogs` | `{ actorId: 1, createdAt: -1 }` | Actor-filtered audit trail queries. |
| `auditlogs` | `{ resourceType: 1, resourceId: 1, createdAt: -1 }` | Per-resource audit history queries. |

## Observed `explain('executionStats')` Plans

Executed against MongoDB on the seeded `workflow_platform` dataset (259 events, 191 records, 6 audit logs):

| Query Pattern | Winning Plan | Index Used | Returned | Keys Examined | Docs Examined |
| --- | --- | --- | --- | --- | --- |
| `Event.find({ sourceId, idempotencyKey })` | `PROJECTION_SIMPLE -> FETCH -> IXSCAN` | `sourceId_1_idempotencyKey_1` | 1 | 1 | 1 |
| `Event.find({ status: 'processed' }).sort({ receivedAt: -1 }).limit(20)` | `LIMIT -> PROJECTION_SIMPLE -> FETCH -> IXSCAN` | `status_1_receivedAt_-1` | 20 | 20 | 20 |
| `Event.find({ status: { $in: ['failed', 'dead_letter'] } }).sort({ receivedAt: -1 }).limit(10)` | `LIMIT -> PROJECTION_SIMPLE -> FETCH -> SORT_MERGE -> IXSCAN` | `status_1_receivedAt_-1` | 10 | 11 | 10 |
| `Event.find({ sourceId }).sort({ receivedAt: -1 }).limit(20)` | `LIMIT -> PROJECTION_SIMPLE -> FETCH -> IXSCAN` | `sourceId_1_receivedAt_-1` | 20 | 20 | 20 |
| `Event.find({ status: { $in: ['valid', 'failed'] }, nextRetryAt: { $lte: cutoff, $ne: null } }).sort({ nextRetryAt: 1 }).limit(1)` | `LIMIT -> PROJECTION_SIMPLE -> FETCH -> SORT_MERGE -> IXSCAN` | `status_1_nextRetryAt_1_processingLockUntil_1` | 1 | 2 | 1 |
| `RecordModel.find({ sourceId }).sort({ createdAt: -1 }).limit(20)` | `LIMIT -> FETCH -> IXSCAN` | `sourceId_1_createdAt_-1` | 20 | 20 | 20 |
| `RecordModel.find({ $text: { $search: 'Northstar' } })` | `TEXT_MATCH -> FETCH -> IXSCAN` | `clientName_text_clientEmail_text_company_text_externalId_text` | 12 | 12 | 12 |
| `AuditLog.find().sort({ createdAt: -1 }).limit(20)` | `LIMIT -> FETCH -> IXSCAN` | `createdAt_-1` | 6 | 6 | 6 |

## Aggregation Pipelines Used in Phase 4

- `GET /api/metrics/summary` ([metricsService.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/services/metricsService.js)): Uses `$match` (leveraging `receivedAt_-1` or `sourceId_1_receivedAt_-1`) followed by a single-pass `$facet` with `byStatus` (`$group` by status), `bySource` (`$group` by `sourceId` + `$lookup` projecting only `name`, `schemaType`, `active`), and `latency` (`$avg` of `processedAt - receivedAt`).
- `GET /api/metrics/timeseries` ([metricsService.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/services/metricsService.js)): Uses `$match` + `$group` bucketed by `$dateToString` (`%Y-%m-%d` or `%Y-%m-%dT%H:00:00Z` UTC) + `$sort: { _id: 1 }`.
- `GET /api/events` & `GET /api/records` ([dashboardService.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/services/dashboardService.js)): Use `$match` (with escaped regex via `escapeRegex()` for partial substring search) + `$sort` + `$facet` (`items` with `$skip`/`$limit` + `$lookup` to `sources` projecting only non-secret fields, plus `totalCount`).

