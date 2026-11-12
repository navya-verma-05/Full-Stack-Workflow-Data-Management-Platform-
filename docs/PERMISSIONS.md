# Route Permissions Matrix (Generated from Code)

Generated directly from:
- [app.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/app.js)
- [healthRoutes.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/routes/healthRoutes.js)
- [authRoutes.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/routes/authRoutes.js)
- [userRoutes.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/routes/userRoutes.js)
- [sourceRoutes.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/routes/sourceRoutes.js)
- [eventRoutes.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/routes/eventRoutes.js)
- [webhookRoutes.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/routes/webhookRoutes.js)

## Implemented Routes vs. Roles

| HTTP Method | Path | Public | `admin` | `manager` | `viewer` | Enforcing Middleware |
| --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/api/health` | Allowed | Allowed | Allowed | Allowed | None (public health endpoint) |
| `POST` | `/api/auth/register` | Allowed **only when 0 users exist AND valid `x-bootstrap-token` header is provided**; Denied (`401`/`403`) otherwise | Allowed | Denied (`403`) | Denied (`403`) | `authLimiter`, `allowBootstrapOrAdmin` (`x-bootstrap-token` + atomic `SystemLock` on bootstrap; `authenticate` + `authorize('admin')` thereafter), `validate(registerSchema)` |
| `POST` | `/api/auth/login` | Allowed | Allowed | Allowed | Allowed | `authLimiter`, `validate(loginSchema)` |
| `POST` | `/api/auth/refresh` | Denied (`401`) without valid `refreshToken` cookie | Allowed (valid cookie) | Allowed (valid cookie) | Allowed (valid cookie) | `authLimiter` + `refreshSession` DB/JWT check |
| `POST` | `/api/auth/logout` | Allowed | Allowed | Allowed | Allowed | None (`logoutSession` revokes cookie token in DB if present + clears cookie) |
| `GET` | `/api/auth/me` | Denied (`401`) | Allowed | Allowed | Allowed | `authenticate`, `authorize('admin', 'manager', 'viewer')` |
| `GET` | `/api/users` | Denied (`401`) | Allowed | Denied (`403`) | Denied (`403`) | Router `authenticate`, `authorize('admin')`, `validate(listUsersSchema)` |
| `GET` | `/api/users/:id` | Denied (`401`) | Allowed | Denied (`403`) | Denied (`403`) | Router `authenticate`, `authorize('admin')`, `validate(userIdParamSchema)` |
| `PATCH` | `/api/users/:id` | Denied (`401`) | Allowed | Denied (`403`) | Denied (`403`) | Router `authenticate`, `authorize('admin')`, `validate(updateUserSchema)` |
| `GET` | `/api/sources` | Denied (`401`) | Allowed | Allowed | Allowed | Router `authenticate`, `authorize('admin', 'manager', 'viewer')`, `validate(listSourcesSchema)` |
| `GET` | `/api/sources/:id` | Denied (`401`) | Allowed | Allowed | Allowed | Router `authenticate`, `authorize('admin', 'manager', 'viewer')`, `validate(sourceIdParamSchema)` |
| `POST` | `/api/sources` | Denied (`401`) | Allowed | Denied (`403`) | Denied (`403`) | Router `authenticate`, `authorize('admin')`, `validate(createSourceSchema)` |
| `PATCH` | `/api/sources/:id` | Denied (`401`) | Allowed | Denied (`403`) | Denied (`403`) | Router `authenticate`, `authorize('admin')`, `validate(updateSourceSchema)` |
| `POST` | `/api/sources/:id/rotate-secret` | Denied (`401`) | Allowed | Denied (`403`) | Denied (`403`) | Router `authenticate`, `authorize('admin')`, `validate(sourceIdParamSchema)` |
| `POST` | `/api/events/:id/replay` | Denied (`401`) | Allowed | Allowed | Denied (`403`) | Router `authenticate`, `authorize('admin', 'manager')`, `validate(replayEventSchema)` |
| `POST` | `/api/webhooks/:sourceId` | Allowed only with valid HMAC-SHA256 signature & fresh timestamp (`401` otherwise) | N/A | N/A | N/A | `webhookLimiter`, `validate(webhookParamsSchema)`, `verifyWebhookSignatureAndTimestamp` (AES-256-GCM decrypt + `crypto.timingSafeEqual` over raw body bytes + replay tolerance) |

## Viewer Write-Access Check
- **Routes where `viewer` can write**: **None.** Every mutation route (`POST /api/auth/register` post-bootstrap, `PATCH /api/users/:id`, `POST /api/sources`, `PATCH /api/sources/:id`, `POST /api/sources/:id/rotate-secret`, `POST /api/events/:id/replay`) denies `viewer` with `403 FORBIDDEN`.
