# Role-Based Access Control (RBAC) & Route Permissions

## Roles

| Role | Description |
| --- | --- |
| `admin` | Full administrative access: manage users, sources, secrets, events, records, and audit logs. |
| `manager` | Operational write access: read all metrics/events/records/audit logs and replay failed events; cannot manage users or rotate source secrets. |
| `viewer` | Read-only access: view metrics, events, records, and audit logs; no mutations allowed. |

## Route Permissions Matrix

| Method & Route | Status | Unauthenticated | `viewer` | `manager` | `admin` | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /api/health` | Implemented (Phase 1) | Allowed | Allowed | Allowed | Allowed | Public liveness & DB status |
| `POST /api/auth/register` | Implemented (Phase 2) | Bootstrap only (0 users) / 401 | 403 | 403 | Allowed | First user forced to `admin`; admin-only thereafter |
| `POST /api/auth/login` | Implemented (Phase 2) | Allowed | Allowed | Allowed | Allowed | Issues JWT access token + `httpOnly` refresh cookie |
| `POST /api/auth/refresh` | Implemented (Phase 2) | Cookie required (401 if missing) | Allowed (with cookie) | Allowed (with cookie) | Allowed (with cookie) | Rotates refresh cookie & issues access token |
| `POST /api/auth/logout` | Implemented (Phase 2) | Allowed | Allowed | Allowed | Allowed | Clears `httpOnly` refresh cookie |
| `GET /api/auth/me` | Implemented (Phase 2) | 401 | Allowed | Allowed | Allowed | Returns authenticated user profile |
| `GET /api/users` | Implemented (Phase 2) | 401 | 403 | 403 | Allowed | Paginated user listing |
| `GET /api/users/:id` | Implemented (Phase 2) | 401 | 403 | 403 | Allowed | Single user detail |
| `PATCH /api/users/:id` | Implemented (Phase 2) | 401 | 403 | 403 | Allowed | Update role/active/name (blocks self-demotion) |
| `POST /api/webhooks/:sourceId` | Planned (Phase 3) | HMAC-SHA256 signed | N/A | N/A | N/A | External system webhook ingestion |
| `GET /api/sources` | Planned (Phase 3) | 401 | Allowed | Allowed | Allowed | List configured sources (no secrets) |
| `POST /api/sources` | Planned (Phase 3) | 401 | 403 | 403 | Allowed | Create source (signing secret shown once) |
| `POST /api/sources/:id/rotate-secret` | Planned (Phase 3) | 401 | 403 | 403 | Allowed | Rotate signing secret |
| `PATCH /api/sources/:id` | Planned (Phase 3) | 401 | 403 | 403 | Allowed | Enable / disable source |
| `POST /api/events/:id/replay` | Planned (Phase 3) | 401 | 403 | Allowed | Allowed | Replay failed/dead-lettered event |
| `GET /api/metrics/*` | Planned (Phase 4) | 401 | Allowed | Allowed | Allowed | Aggregated metrics & time series |
| `GET /api/events`, `GET /api/events/:id` | Planned (Phase 4) | 401 | Allowed | Allowed | Allowed | Filtered event list & processing logs |
| `GET /api/records` | Planned (Phase 4) | 401 | Allowed | Allowed | Allowed | Normalized client records |
| `GET /api/audit-logs` | Planned (Phase 4) | 401 | Allowed | Allowed | Allowed | Paginated audit trail |

