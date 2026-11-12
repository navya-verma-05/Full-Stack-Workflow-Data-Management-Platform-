# Route Permissions Matrix (Generated from Code)

Generated directly from:
- [app.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/app.js)
- [healthRoutes.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/routes/healthRoutes.js)
- [authRoutes.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/routes/authRoutes.js)
- [userRoutes.js](file:///c:/Users/ASUS/Desktop/projects/workflow%20and%20data%20management%20platform/server/src/routes/userRoutes.js)

## Implemented Routes vs. Roles

| HTTP Method | Path | Public | `admin` | `manager` | `viewer` | Enforcing Middleware |
| --- | --- | --- | --- | --- | --- | --- |
| `GET` | `/api/health` | Allowed | Allowed | Allowed | Allowed | None (public health endpoint) |
| `POST` | `/api/auth/register` | Allowed **only when 0 users exist** (bootstrap first admin); Denied (`401`) afterward | Allowed | Denied (`403`) | Denied (`403`) | `authLimiter`, `allowBootstrapOrAdmin` (`authenticate` + `authorize('admin')` once `User.countDocuments() > 0`), `validate(registerSchema)` |
| `POST` | `/api/auth/login` | Allowed | Allowed | Allowed | Allowed | `authLimiter`, `validate(loginSchema)` (no auth/RBAC middleware — credential exchange) |
| `POST` | `/api/auth/refresh` | Denied (`401`) without valid `refreshToken` cookie | Allowed (valid cookie) | Allowed (valid cookie) | Allowed (valid cookie) | `authLimiter` + `refreshSession` server-side cookie/JWT/DB verification (no `authenticate`/`authorize` middleware) |
| `POST` | `/api/auth/logout` | Allowed | Allowed | Allowed | Allowed | None (`logoutSession` revokes `refreshToken` cookie in DB if present and clears cookie) |
| `GET` | `/api/auth/me` | Denied (`401`) | Allowed | Allowed | Allowed | `authenticate`, `authorize('admin', 'manager', 'viewer')` |
| `GET` | `/api/users` | Denied (`401`) | Allowed | Denied (`403`) | Denied (`403`) | Router `authenticate`, `authorize('admin')`, `validate(listUsersSchema)` |
| `GET` | `/api/users/:id` | Denied (`401`) | Allowed | Denied (`403`) | Denied (`403`) | Router `authenticate`, `authorize('admin')`, `validate(userIdParamSchema)` |
| `PATCH` | `/api/users/:id` | Denied (`401`) | Allowed | Denied (`403`) | Denied (`403`) | Router `authenticate`, `authorize('admin')`, `validate(updateUserSchema)` |

## Security Audit Findings on Current Routes

- **Routes without authorization middleware (`authorize`)**:
  1. `GET /api/health` — intentional public liveness & database connectivity probe.
  2. `POST /api/auth/login` — intentional public login endpoint (rate-limited via `authLimiter`, schema-validated via `validate(loginSchema)`).
  3. `POST /api/auth/refresh` — relies on signed `httpOnly` `refreshToken` cookie verified against the `RefreshToken` collection in MongoDB (rate-limited via `authLimiter`).
  4. `POST /api/auth/logout` — intentionally callable without an access token so expired-access-token clients can still revoke their `refreshToken` cookie server-side and clear the browser cookie.
  5. `POST /api/auth/register` (bootstrap case only) — intentionally permits unauthenticated `POST` **only** when `User.countDocuments() === 0` to create the initial `admin`; all subsequent calls enforce `authenticate` + `authorize('admin')`.
- **Routes where `viewer` can write**: **None.** All mutation routes (`POST /api/auth/register` post-bootstrap, `PATCH /api/users/:id`) enforce `authorize('admin')` and reject `viewer` with `403 FORBIDDEN`.
