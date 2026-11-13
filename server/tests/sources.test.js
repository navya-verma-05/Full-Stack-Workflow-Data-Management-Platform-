import { describe, expect, it } from "vitest";
import request from "supertest";
import { createTestUser, getApp } from "./helpers.js";
import { Source } from "../src/models/Source.js";
import { Event } from "../src/models/Event.js";
import { decryptSecret } from "../src/utils/crypto.js";

describe("Sources & Phase 3 Write Route RBAC", () => {
  it("allows admin to create source (showing credentials once), encrypts signingSecret at rest, and rotates secret", async () => {
    const app = getApp();
    const admin = await createTestUser({
      email: "admin@example.com",
      role: "admin",
    });

    const createRes = await request(app)
      .post("/api/sources")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({
        name: "Marketing Web Form",
        description: "Lead capture webhook",
        schemaType: "web_form",
      });

    expect(createRes.status).toBe(201);
    expect(createRes.body.source.name).toBe("Marketing Web Form");
    expect(createRes.body.credentials.apiKey).toMatch(/^wpk_/);
    expect(createRes.body.credentials.signingSecret).toMatch(/^whsec_/);

    // Subsequent GETs never return credentials or encrypted fields
    const listRes = await request(app)
      .get("/api/sources")
      .set("Authorization", `Bearer ${admin.accessToken}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.items).toHaveLength(1);
    expect(listRes.body.items[0].signingSecret).toBeUndefined();
    expect(listRes.body.items[0].signingSecretEncrypted).toBeUndefined();
    expect(listRes.body.items[0].apiKeyHash).toBeUndefined();

    // Verify AES-256-GCM encryption at rest in MongoDB
    const rawDoc = await Source.findById(createRes.body.source._id).select(
      "+signingSecretEncrypted +signingSecretHash +apiKeyHash",
    );
    expect(rawDoc.signingSecretEncrypted).not.toBe(
      createRes.body.credentials.signingSecret,
    );
    expect(decryptSecret(rawDoc.signingSecretEncrypted)).toBe(
      createRes.body.credentials.signingSecret,
    );

    // Rotate secret
    const rotateRes = await request(app)
      .post(`/api/sources/${createRes.body.source._id}/rotate-secret`)
      .set("Authorization", `Bearer ${admin.accessToken}`);
    expect(rotateRes.status).toBe(200);
    expect(rotateRes.body.signingSecret).toMatch(/^whsec_/);
    expect(rotateRes.body.signingSecret).not.toBe(
      createRes.body.credentials.signingSecret,
    );

    // Update active flag
    const patchRes = await request(app)
      .patch(`/api/sources/${createRes.body.source._id}`)
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ active: false });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.source.active).toBe(false);
  });

  it("denies viewer with 403 on all Phase 3 write routes and allows viewer read access to sources", async () => {
    const app = getApp();
    const admin = await createTestUser({
      email: "admin@example.com",
      role: "admin",
    });
    const manager = await createTestUser({
      email: "manager@example.com",
      role: "manager",
    });
    const viewer = await createTestUser({
      email: "viewer@example.com",
      role: "viewer",
    });

    const createRes = await request(app)
      .post("/api/sources")
      .set("Authorization", `Bearer ${admin.accessToken}`)
      .send({ name: "CRM Source", schemaType: "crm" });
    const sourceId = createRes.body.source._id;

    const failedEvent = await Event.create({
      sourceId,
      payload: {
        contactId: "c1",
        name: "A",
        email: "a@example.com",
        stage: "won",
        dealValue: 100,
      },
      status: "dead_letter",
      idempotencyKey: "replay-rbac-1",
      attempts: 3,
      maxAttempts: 3,
    });

    // Viewer can read sources
    const viewerGet = await request(app)
      .get("/api/sources")
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(viewerGet.status).toBe(200);

    // Viewer gets 403 on every Phase 3 write route
    const viewerCreate = await request(app)
      .post("/api/sources")
      .set("Authorization", `Bearer ${viewer.accessToken}`)
      .send({ name: "Blocked Source", schemaType: "generic" });
    expect(viewerCreate.status).toBe(403);

    const viewerPatch = await request(app)
      .patch(`/api/sources/${sourceId}`)
      .set("Authorization", `Bearer ${viewer.accessToken}`)
      .send({ active: false });
    expect(viewerPatch.status).toBe(403);

    const viewerRotate = await request(app)
      .post(`/api/sources/${sourceId}/rotate-secret`)
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(viewerRotate.status).toBe(403);

    const viewerReplay = await request(app)
      .post(`/api/events/${failedEvent._id}/replay`)
      .set("Authorization", `Bearer ${viewer.accessToken}`);
    expect(viewerReplay.status).toBe(403);

    // Manager is denied source mutations (403) but allowed to replay failed events (202)
    const managerCreate = await request(app)
      .post("/api/sources")
      .set("Authorization", `Bearer ${manager.accessToken}`)
      .send({ name: "Blocked Manager Source", schemaType: "generic" });
    expect(managerCreate.status).toBe(403);

    const managerReplay = await request(app)
      .post(`/api/events/${failedEvent._id}/replay`)
      .set("Authorization", `Bearer ${manager.accessToken}`);
    expect(managerReplay.status).toBe(202);
    expect(managerReplay.body.event.status).toBe("valid");
  });
});
