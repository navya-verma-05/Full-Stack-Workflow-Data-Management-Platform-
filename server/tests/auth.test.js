import { describe, expect, it } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import { createTestUser, getApp } from "./helpers.js";
import { User } from "../src/models/User.js";
import { env, parseEnv } from "../src/config/env.js";

describe("Auth Flows (Register, Login, Refresh, Logout, Me)", () => {
  it("forces COOKIE_SECURE=true when NODE_ENV=production", () => {
    const prodEnv = parseEnv({
      ...process.env,
      NODE_ENV: "production",
      COOKIE_SECURE: "false",
    });
    expect(prodEnv.COOKIE_SECURE).toBe(true);
  });

  it("rejects bootstrap registration without valid x-bootstrap-token", async () => {
    const app = getApp();
    const res = await request(app).post("/api/auth/register").send({
      name: "Initial Admin",
      email: "admin@example.com",
      password: "AdminPassword123!",
    });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("INVALID_BOOTSTRAP_TOKEN");
  });

  it("allows bootstrapping the first user as admin with valid x-bootstrap-token and prevents concurrent double-bootstrap", async () => {
    const app = getApp();
    const [resA, resB] = await Promise.all([
      request(app)
        .post("/api/auth/register")
        .set("x-bootstrap-token", process.env.BOOTSTRAP_TOKEN)
        .send({
          name: "Initial Admin A",
          email: "admin-a@example.com",
          password: "AdminPassword123!",
          role: "viewer",
        }),
      request(app)
        .post("/api/auth/register")
        .set("x-bootstrap-token", process.env.BOOTSTRAP_TOKEN)
        .send({
          name: "Initial Admin B",
          email: "admin-b@example.com",
          password: "AdminPassword123!",
          role: "viewer",
        }),
    ]);

    const statuses = [resA.status, resB.status].sort((a, b) => a - b);
    expect(statuses).toEqual([201, 403]);

    const winner = resA.status === 201 ? resA : resB;
    expect(winner.body.user.role).toBe("admin");
    expect(winner.body.user.passwordHash).toBeUndefined();
    expect(winner.body.accessToken).toBeTypeOf("string");
    expect(winner.headers["set-cookie"]).toBeDefined();
    expect(winner.headers["set-cookie"][0]).toContain("HttpOnly");
  });

  it("rejects unauthenticated registration once an admin exists", async () => {
    const app = getApp();
    await createTestUser({ email: "admin@example.com", role: "admin" });

    const res = await request(app).post("/api/auth/register").send({
      name: "Another User",
      email: "viewer@example.com",
      password: "Password123!",
      role: "viewer",
    });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("allows an authenticated admin to register new users and rejects duplicate emails", async () => {
    const app = getApp();
    const { accessToken } = await createTestUser({
      email: "admin@example.com",
      role: "admin",
    });

    const createRes = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Team Manager",
        email: "manager@example.com",
        password: "ManagerPassword123!",
        role: "manager",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.user.role).toBe("manager");
    expect(createRes.body.user.passwordHash).toBeUndefined();

    const dupRes = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${accessToken}`)
      .send({
        name: "Duplicate Manager",
        email: "manager@example.com",
        password: "ManagerPassword123!",
        role: "viewer",
      });

    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error.code).toBe("EMAIL_EXISTS");
  });

  it("logs in, refreshes access token via httpOnly cookie, fetches /me, and logs out", async () => {
    const app = getApp();
    await createTestUser({
      email: "alice@example.com",
      password: "AlicePassword123!",
      role: "manager",
    });

    const agent = request.agent(app);

    const loginRes = await agent.post("/api/auth/login").send({
      email: "alice@example.com",
      password: "AlicePassword123!",
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.accessToken).toBeTypeOf("string");
    expect(loginRes.body.user.email).toBe("alice@example.com");
    expect(loginRes.body.user.passwordHash).toBeUndefined();

    const setCookieHeader = loginRes.headers["set-cookie"]?.join(";") || "";
    expect(setCookieHeader).toContain("refreshToken=");
    expect(setCookieHeader).toContain("HttpOnly");

    const meRes = await agent
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${loginRes.body.accessToken}`);

    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe("alice@example.com");
    expect(meRes.body.user.role).toBe("manager");

    const refreshRes = await agent.post("/api/auth/refresh");
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeTypeOf("string");
    expect(refreshRes.body.user.email).toBe("alice@example.com");

    const logoutRes = await agent.post("/api/auth/logout");
    expect(logoutRes.status).toBe(200);

    const refreshAfterLogout = await agent.post("/api/auth/refresh");
    expect(refreshAfterLogout.status).toBe(401);
  });

  it("rejects bad password with 401 and disabled user with 403", async () => {
    const app = getApp();
    await createTestUser({
      email: "bob@example.com",
      password: "BobPassword123!",
      role: "viewer",
      active: true,
    });

    const badPassRes = await request(app).post("/api/auth/login").send({
      email: "bob@example.com",
      password: "WrongPassword!",
    });
    expect(badPassRes.status).toBe(401);

    await User.updateOne({ email: "bob@example.com" }, { active: false });

    const disabledRes = await request(app).post("/api/auth/login").send({
      email: "bob@example.com",
      password: "BobPassword123!",
    });
    expect(disabledRes.status).toBe(403);
    expect(disabledRes.body.error.code).toBe("ACCOUNT_DISABLED");
  });

  it("rejects tampered and expired JWT access tokens with 401 INVALID_TOKEN", async () => {
    const app = getApp();
    const { user, accessToken } = await createTestUser({
      email: "jwt@example.com",
      role: "viewer",
    });

    const parts = accessToken.split(".");
    const tamperedToken = `${parts[0]}.${parts[1]}.tamperedsignature000`;

    const tamperedRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${tamperedToken}`);
    expect(tamperedRes.status).toBe(401);
    expect(tamperedRes.body.error.code).toBe("INVALID_TOKEN");

    const expiredToken = jwt.sign(
      {
        sub: String(user._id),
        role: user.role,
        email: user.email,
        type: "access",
      },
      env.JWT_ACCESS_SECRET,
      { expiresIn: -10 },
    );

    const expiredRes = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${expiredToken}`);
    expect(expiredRes.status).toBe(401);
    expect(expiredRes.body.error.code).toBe("INVALID_TOKEN");
  });

  it("invalidates the refresh token server-side on logout so replaying the old cookie fails with 401", async () => {
    const app = getApp();
    await createTestUser({
      email: "replay@example.com",
      password: "ReplayPassword123!",
      role: "viewer",
    });

    const loginRes = await request(app).post("/api/auth/login").send({
      email: "replay@example.com",
      password: "ReplayPassword123!",
    });
    expect(loginRes.status).toBe(200);

    const rawCookie = loginRes.headers["set-cookie"]?.[0]?.split(";")[0];
    expect(rawCookie).toContain("refreshToken=");

    const logoutRes = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", rawCookie);
    expect(logoutRes.status).toBe(200);

    // Replay the exact pre-logout cookie directly to verify server-side revocation
    const replayRes = await request(app)
      .post("/api/auth/refresh")
      .set("Cookie", rawCookie);
    expect(replayRes.status).toBe(401);
    expect(replayRes.body.error.code).toBe("REFRESH_TOKEN_REVOKED");
  });
});
