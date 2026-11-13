import { describe, expect, it, vi } from "vitest";
import request from "supertest";
import { createTestUser, getApp } from "./helpers.js";
import { authorize } from "../src/middleware/auth.js";

describe("Role-Based Access Control (admin, manager, viewer)", () => {
  it("allows admin, manager, and viewer on GET /api/auth/me and denies unauthenticated", async () => {
    const app = getApp();
    const admin = await createTestUser({
      email: "a@example.com",
      role: "admin",
    });
    const manager = await createTestUser({
      email: "m@example.com",
      role: "manager",
    });
    const viewer = await createTestUser({
      email: "v@example.com",
      role: "viewer",
    });

    const unauth = await request(app).get("/api/auth/me");
    expect(unauth.status).toBe(401);

    for (const account of [admin, manager, viewer]) {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Authorization", `Bearer ${account.accessToken}`);
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe(account.user.role);
    }
  });

  it("allows only admin on POST /api/auth/register after bootstrap and denies manager/viewer", async () => {
    const app = getApp();
    const admin = await createTestUser({
      email: "a@example.com",
      role: "admin",
    });
    const manager = await createTestUser({
      email: "m@example.com",
      role: "manager",
    });
    const viewer = await createTestUser({
      email: "v@example.com",
      role: "viewer",
    });

    for (const denied of [manager, viewer]) {
      const res = await request(app)
        .post("/api/auth/register")
        .set("Authorization", `Bearer ${denied.accessToken}`)
        .send({
          name: "Blocked User",
          email: "blocked@example.com",
          password: "Password123!",
          role: "viewer",
        });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    }

    const allowed = await request(app)
      .post("/api/auth/register")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        name: "Created User",
        email: "created@example.com",
        password: "Password123!",
        role: "viewer",
      });
    expect(allowed.status).toBe(201);
  });

  it("allows only admin on GET /api/users, GET /api/users/:id, PATCH /api/users/:id", async () => {
    const app = getApp();
    const admin = await createTestUser({
      email: "a@example.com",
      role: "admin",
    });
    const manager = await createTestUser({
      email: "m@example.com",
      role: "manager",
    });
    const viewer = await createTestUser({
      email: "v@example.com",
      role: "viewer",
    });

    // Unauthenticated
    expect((await request(app).get("/api/users")).status).toBe(401);

    // Manager & Viewer denied (403)
    for (const denied of [manager, viewer]) {
      const listRes = await request(app)
        .get("/api/users")
        .set("Authorization", `Bearer ${denied.accessToken}`);
      expect(listRes.status).toBe(403);

      const getRes = await request(app)
        .get(`/api/users/${viewer.user._id}`)
        .set("Authorization", `Bearer ${denied.accessToken}`);
      expect(getRes.status).toBe(403);

      const patchRes = await request(app)
        .patch(`/api/users/${viewer.user._id}`)
        .set("Authorization", `Bearer ${denied.accessToken}`)
        .send({ role: "admin" });
      expect(patchRes.status).toBe(403);
    }

    // Admin allowed
    const adminList = await request(app)
      .get("/api/users")
      .set("Authorization", `Bearer ${admin.accessToken}`);
    expect(adminList.status).toBe(200);
    expect(adminList.body.items).toHaveLength(3);

    const adminPatch = await request(app)
      .patch(`/api/users/${viewer.user._id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ role: "manager" });
    expect(adminPatch.status).toBe(200);
    expect(adminPatch.body.user.role).toBe("manager");

    // Admin self-demotion guard
    const selfDemote = await request(app)
      .patch(`/api/users/${admin.user._id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ role: "viewer" });
    expect(selfDemote.status).toBe(400);
    expect(selfDemote.body.error.code).toBe("SELF_MODIFICATION_FORBIDDEN");
  });

  it("authorize middleware grants admin/manager and denies viewer when configured for operational writes", () => {
    const mw = authorize("admin", "manager");

    const nextAdmin = vi.fn();
    mw({ user: { role: "admin" } }, {}, nextAdmin);
    expect(nextAdmin).toHaveBeenCalledWith();

    const nextManager = vi.fn();
    mw({ user: { role: "manager" } }, {}, nextManager);
    expect(nextManager).toHaveBeenCalledWith();

    const nextViewer = vi.fn();
    mw({ user: { role: "viewer" } }, {}, nextViewer);
    const err = nextViewer.mock.calls[0][0];
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });
});
