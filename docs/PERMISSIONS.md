# Route Permissions Matrix (Generated from Code)

Generated directly from:
- [app.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/app.js)
- [healthRoutes.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/routes/healthRoutes.js)
- [authRoutes.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/routes/authRoutes.js)
- [userRoutes.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/routes/userRoutes.js)
- [sourceRoutes.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/routes/sourceRoutes.js)
- [eventRoutes.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/routes/eventRoutes.js)
- [metricsRoutes.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/routes/metricsRoutes.js)
- [recordRoutes.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/routes/recordRoutes.js)
- [auditRoutes.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/routes/auditRoutes.js)
- [webhookRoutes.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/routes/webhookRoutes.js)

## Implemented Routes vs. Roles

| HTTP Method | Path | Public | `admin` | `manager` | `viewer` | Enforcing Middleware |
| --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/api/health` | Allowed | Allowed | Allowed | Allowed | None (public health endpoint) |
| `POST` | `/api/auth/register` | Bootstrap only (0 users + `x-bootstrap-token`); Denied (`401`/`403`) otherwise | Allowed | Denied (`403`) | Denied (`403`) | `authLimiter`, `allowBootstrapOrAdmin`, `validate(registerSchema)` |
| `POST` | `/api/auth/login` | Allowed | Allowed | Allowed | Allowed | `authLimiter`, `validate(loginSchema)` |
| `POST` | `/api/auth/refresh` | Denied (`401`) without valid cookie | Allowed (cookie) | Allowed (cookie) | Allowed (cookie) | `authLimiter` + `refreshSession` DB/JWT check |
| `POST` | `/api/auth/logout` | Allowed | Allowed | Allowed | Allowed | None (`logoutSession` revokes cookie token in DB + clears cookie) |
| `GET` | `/api/auth/me` | Denied (`401`) | Allowed | Allowed | Allowed | `authenticate`, `authorize('admin', 'manager', 'viewer')` |
| `GET` | `/api/users` | Denied (`401`) | Allowed | Denied (`403`) | Denied (`403`) | Router `authenticate`, `authorize('admin')`, `validate(listUsersSchema)` |
| `GET` | `/api/users/:id` | Denied (`401`) | Allowed | Denied (`403`) | Denied (`403`) | Router `authenticate`, `authorize('admin')`, `validate(userIdParamSchema)` |
| `PATCH` | `/api/users/:id` | Denied (`401`) | Allowed | Denied (`403`) | Denied (`403`) | Router `authenticate`, `authorize('admin')`, `validate(updateUserSchema)` |
| `GET` | `/api/sources` | Denied (`401`) | Allowed | Allowed | Allowed | Router `authenticate`, `authorize('admin', 'manager', 'viewer')`, `validate(listSourcesSchema)` |
| `GET` | `/api/sources/:id` | Denied (`401`) | Allowed | Allowed | Allowed | Router `authenticate`, `authorize('admin', 'manager', 'viewer')`, `validate(sourceIdParamSchema)` |
| `POST` | `/api/sources` | Denied (`401`) | Allowed | Denied (`403`) | Denied (`403`) | Router `authenticate`, `authorize('admin')`, `validate(createSourceSchema)` |
| `PATCH` | `/api/sources/:id` | Denied (`401`) | Allowed | Denied (`403`) | Denied (`403`) | Router `authenticate`, `authorize('admin')`, `validate(updateSourceSchema)` |
| `POST` | `/api/sources/:id/rotate-secret` | Denied (`401`) | Allowed | Denied (`403`) | Denied (`403`) | Router `authenticate`, `authorize('admin')`, `validate(sourceIdParamSchema)` |
| `GET` | `/api/events` | Denied (`401`) | Allowed | Allowed | Allowed | Router `authenticate`, `authorize('admin', 'manager', 'viewer')`, `validate(listEventsSchema)` |
| `GET` | `/api/events/:id` | Denied (`401`) | Allowed | Allowed | Allowed | Router `authenticate`, `authorize('admin', 'manager', 'viewer')`, `validate(eventIdParamSchema)` |
| `POST` | `/api/events/:id/replay` | Denied (`401`) | Allowed | Allowed | Denied (`403`) | Router `authenticate`, `authorize('admin', 'manager')`, `validate(replayEventSchema)` |
| `GET` | `/api/metrics/summary` | Denied (`401`) | Allowed | Allowed | Allowed | Router `authenticate`, `authorize('admin', 'manager', 'viewer')`, `validate(metricsSummarySchema)` |
| `GET` | `/api/metrics/timeseries` | Denied (`401`) | Allowed | Allowed | Allowed | Router `authenticate`, `authorize('admin', 'manager', 'viewer')`, `validate(metricsTimeSeriesSchema)` |
| `GET` | `/api/records` | Denied (`401`) | Allowed | Allowed | Allowed | Router `authenticate`, `authorize('admin', 'manager', 'viewer')`, `validate(listRecordsSchema)` |
| `GET` | `/api/audit-logs` | Denied (`401`) | Allowed | Denied (`403`) | Denied (`403`) | Router `authenticate`, `authorize('admin')`, `validate(listAuditLogsSchema)` |
| `POST` | `/api/webhooks/:sourceId` | HMAC-SHA256 signed (`401` otherwise) | N/A | N/A | N/A | `webhookLimiter`, `validate(webhookParamsSchema)`, `verifyWebhookSignatureAndTimestamp` |

## Viewer Write-Access Check
- **Routes where `viewer` can write**: **None.** Every mutation route rejects `viewer` with `403 FORBIDDEN`.
