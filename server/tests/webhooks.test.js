import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestUser, getApp } from './helpers.js';
import { Event } from '../src/models/Event.js';
import { RecordModel } from '../src/models/Record.js';
import { computeWebhookHmacHex } from '../src/utils/crypto.js';
import {
  claimNextEvent,
  processClaimedEvent,
  processPendingEvents,
} from '../src/jobs/eventWorker.js';

async function setupSource(app, adminToken, overrides = {}) {
  const res = await request(app)
    .post('/api/sources')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: overrides.name || `Source-${Math.random().toString(36).slice(2, 8)}`,
      schemaType: overrides.schemaType || 'web_form',
      active: overrides.active ?? true,
    });
  return {
    sourceId: res.body.source._id,
    signingSecret: res.body.credentials.signingSecret,
  };
}

function signPayload(secret, bodyObj, timestamp = Math.floor(Date.now() / 1000)) {
  const rawBody = JSON.stringify(bodyObj);
  const sig = computeWebhookHmacHex(secret, String(timestamp), Buffer.from(rawBody, 'utf8'));
  return {
    rawBody,
    timestamp: String(timestamp),
    signature: `sha256=${sig}`,
  };
}

describe('Webhook Ingestion Pipeline, HMAC, Idempotency & Retry Worker', () => {
  it('ingests a valid signed webhook and processes it into a normalized Record', async () => {
    const app = getApp();
    const admin = await createTestUser({ email: 'admin@example.com', role: 'admin' });
    const { sourceId, signingSecret } = await setupSource(app, admin.accessToken, {
      schemaType: 'web_form',
    });

    const payload = {
      submissionId: 'sub-1001',
      fullName: 'Jane Doe',
      email: 'jane@acme.test',
      company: 'Acme Inc',
      topic: 'enterprise_demo',
    };
    const { rawBody, timestamp, signature } = signPayload(signingSecret, payload);

    const res = await request(app)
      .post(`/api/webhooks/${sourceId}`)
      .set('Content-Type', 'application/json')
      .set('x-webhook-timestamp', timestamp)
      .set('x-webhook-signature', signature)
      .set('x-idempotency-key', 'idem-valid-1')
      .send(rawBody);

    expect(res.status).toBe(202);
    expect(res.body.duplicate).toBe(false);
    expect(res.body.status).toBe('valid');

    await processPendingEvents();

    const event = await Event.findById(res.body.eventId);
    expect(event.status).toBe('processed');
    expect(event.recordId).toBeTruthy();

    const record = await RecordModel.findById(event.recordId);
    expect(record.clientName).toBe('Jane Doe');
    expect(record.clientEmail).toBe('jane@acme.test');
    expect(record.company).toBe('Acme Inc');
    expect(record.externalId).toBe('sub-1001');
  });

  it('rejects wrong signature, missing signature, stale timestamp, and body altered after signing', async () => {
    const app = getApp();
    const admin = await createTestUser({ email: 'admin@example.com', role: 'admin' });
    const { sourceId, signingSecret } = await setupSource(app, admin.accessToken, {
      schemaType: 'generic',
    });

    const payload = { clientName: 'Test Client', externalId: 'ext-1' };
    const { rawBody, timestamp, signature } = signPayload(signingSecret, payload);

    // 1. Wrong signature
    const wrongSig = await request(app)
      .post(`/api/webhooks/${sourceId}`)
      .set('Content-Type', 'application/json')
      .set('x-webhook-timestamp', timestamp)
      .set('x-webhook-signature', `sha256=${'0'.repeat(64)}`)
      .set('x-idempotency-key', 'idem-wrong-sig')
      .send(rawBody);
    expect(wrongSig.status).toBe(401);
    expect(wrongSig.body.error.code).toBe('INVALID_WEBHOOK_SIGNATURE');

    // 2. Missing signature
    const missingSig = await request(app)
      .post(`/api/webhooks/${sourceId}`)
      .set('Content-Type', 'application/json')
      .set('x-webhook-timestamp', timestamp)
      .set('x-idempotency-key', 'idem-missing-sig')
      .send(rawBody);
    expect(missingSig.status).toBe(401);
    expect(missingSig.body.error.code).toBe('MISSING_WEBHOOK_AUTH');

    // 3. Stale timestamp (> 300s tolerance)
    const staleTs = Math.floor(Date.now() / 1000) - 600;
    const staleSigned = signPayload(signingSecret, payload, staleTs);
    const staleRes = await request(app)
      .post(`/api/webhooks/${sourceId}`)
      .set('Content-Type', 'application/json')
      .set('x-webhook-timestamp', staleSigned.timestamp)
      .set('x-webhook-signature', staleSigned.signature)
      .set('x-idempotency-key', 'idem-stale-ts')
      .send(staleSigned.rawBody);
    expect(staleRes.status).toBe(401);
    expect(staleRes.body.error.code).toBe('WEBHOOK_TIMESTAMP_OUT_OF_RANGE');

    // 4. Body altered after signing (same signature, tampered raw body)
    const alteredBody = JSON.stringify({ clientName: 'Tampered Client', externalId: 'ext-1' });
    const alteredRes = await request(app)
      .post(`/api/webhooks/${sourceId}`)
      .set('Content-Type', 'application/json')
      .set('x-webhook-timestamp', timestamp)
      .set('x-webhook-signature', signature)
      .set('x-idempotency-key', 'idem-altered')
      .send(alteredBody);
    expect(alteredRes.status).toBe(401);
    expect(alteredRes.body.error.code).toBe('INVALID_WEBHOOK_SIGNATURE');
  });

  it('stores invalid payload with status invalid and schema errors without creating a Record', async () => {
    const app = getApp();
    const admin = await createTestUser({ email: 'admin@example.com', role: 'admin' });
    const { sourceId, signingSecret } = await setupSource(app, admin.accessToken, {
      schemaType: 'crm',
    });

    const malformed = { contactId: 'c-1', name: 'Bad Email', email: 'not-an-email' };
    const { rawBody, timestamp, signature } = signPayload(signingSecret, malformed);

    const res = await request(app)
      .post(`/api/webhooks/${sourceId}`)
      .set('Content-Type', 'application/json')
      .set('x-webhook-timestamp', timestamp)
      .set('x-webhook-signature', signature)
      .set('x-idempotency-key', 'idem-invalid-1')
      .send(rawBody);

    expect(res.status).toBe(422);
    expect(res.body.status).toBe('invalid');
    expect(res.body.error.code).toBe('INVALID_WEBHOOK_PAYLOAD');
    expect(res.body.error.details.length).toBeGreaterThan(0);

    const event = await Event.findById(res.body.eventId);
    expect(event.status).toBe('invalid');
    expect(event.errors.length).toBeGreaterThan(0);
    expect(await RecordModel.countDocuments()).toBe(0);
  });

  it('handles sequential and concurrent duplicate idempotency keys without creating duplicate records', async () => {
    const app = getApp();
    const admin = await createTestUser({ email: 'admin@example.com', role: 'admin' });
    const { sourceId, signingSecret } = await setupSource(app, admin.accessToken, {
      schemaType: 'partner',
    });

    const payload = {
      partnerRef: 'ord-77',
      customer: { name: 'Bob', email: 'bob@partner.test', organization: 'PartnerCo' },
      items: [{ sku: 'PRO-1', quantity: 2, unitPrice: 50 }],
      currency: 'USD',
    };
    const { rawBody, timestamp, signature } = signPayload(signingSecret, payload);

    // Concurrent duplicate deliveries
    const [r1, r2] = await Promise.all([
      request(app)
        .post(`/api/webhooks/${sourceId}`)
        .set('Content-Type', 'application/json')
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-signature', signature)
        .set('x-idempotency-key', 'idem-dup-key')
        .send(rawBody),
      request(app)
        .post(`/api/webhooks/${sourceId}`)
        .set('Content-Type', 'application/json')
        .set('x-webhook-timestamp', timestamp)
        .set('x-webhook-signature', signature)
        .set('x-idempotency-key', 'idem-dup-key')
        .send(rawBody),
    ]);

    const statuses = [r1.status, r2.status].sort((a, b) => a - b);
    expect(statuses).toEqual([200, 202]);

    // Sequential duplicate delivery
    const r3 = await request(app)
      .post(`/api/webhooks/${sourceId}`)
      .set('Content-Type', 'application/json')
      .set('x-webhook-timestamp', timestamp)
      .set('x-webhook-signature', signature)
      .set('x-idempotency-key', 'idem-dup-key')
      .send(rawBody);
    expect(r3.status).toBe(200);
    expect(r3.body.duplicate).toBe(true);

    await processPendingEvents();

    expect(await Event.countDocuments({ sourceId, idempotencyKey: 'idem-dup-key' })).toBe(1);
    expect(await RecordModel.countDocuments({ sourceId })).toBe(1);
    const rec = await RecordModel.findOne({ sourceId });
    expect(rec.amount).toBe(100);
  });

  it('claims jobs atomically across concurrent workers, retries with backoff to success, and dead-letters exhausted jobs', async () => {
    const app = getApp();
    const admin = await createTestUser({ email: 'admin@example.com', role: 'admin' });
    const { sourceId, signingSecret } = await setupSource(app, admin.accessToken, {
      schemaType: 'generic',
    });

    // 1. Atomic claim concurrency test
    const p1 = { clientName: 'Atomic Co', externalId: 'atom-1' };
    const s1 = signPayload(signingSecret, p1);
    const res1 = await request(app)
      .post(`/api/webhooks/${sourceId}`)
      .set('Content-Type', 'application/json')
      .set('x-webhook-timestamp', s1.timestamp)
      .set('x-webhook-signature', s1.signature)
      .set('x-idempotency-key', 'idem-atomic-1')
      .send(s1.rawBody);
    expect(res1.status).toBe(202);

    const [claimA, claimB] = await Promise.all([
      claimNextEvent('worker-A'),
      claimNextEvent('worker-B'),
    ]);
    const claimed = [claimA, claimB].filter(Boolean);
    expect(claimed).toHaveLength(1);

    // 2. Retry then success (attempt 1 fails transiently, attempt 2 succeeds)
    let calls = 0;
    const firstTry = await processClaimedEvent(claimed[0], {
      baseDelayMs: 10,
      handler: async () => {
        calls += 1;
        if (calls === 1) throw new Error('Simulated transient failure');
        return RecordModel.create({
          sourceId,
          eventId: claimed[0]._id,
          clientName: 'Atomic Co',
          externalId: 'atom-1',
        });
      },
    });
    expect(firstTry.status).toBe('failed');
    expect(firstTry.attempts).toBe(1);
    expect(firstTry.nextRetryAt).toBeTruthy();

    await new Promise((r) => setTimeout(r, 20));
    const retryClaim = await claimNextEvent('worker-A');
    expect(retryClaim).toBeTruthy();
    const secondTry = await processClaimedEvent(retryClaim, {
      baseDelayMs: 10,
      handler: async () =>
        RecordModel.create({
          sourceId,
          eventId: retryClaim._id,
          clientName: 'Atomic Co',
          externalId: 'atom-1',
        }),
    });
    expect(secondTry.status).toBe('processed');
    expect(secondTry.attempts).toBe(2);

    // 3. Retry then dead-letter after maxAttempts (3)
    const p2 = { clientName: 'DeadLetter Co', externalId: 'dl-1' };
    const s2 = signPayload(signingSecret, p2);
    const res2 = await request(app)
      .post(`/api/webhooks/${sourceId}`)
      .set('Content-Type', 'application/json')
      .set('x-webhook-timestamp', s2.timestamp)
      .set('x-webhook-signature', s2.signature)
      .set('x-idempotency-key', 'idem-dl-1')
      .send(s2.rawBody);
    expect(res2.status).toBe(202);

    const alwaysFail = async () => {
      throw new Error('Downstream timeout');
    };

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      await Event.updateOne({ _id: res2.body.eventId }, { nextRetryAt: new Date(Date.now() - 5) });
      const results = await processPendingEvents({ handler: alwaysFail, baseDelayMs: 10 });
      expect(results).toHaveLength(1);
      if (attempt < 3) {
        expect(results[0].status).toBe('failed');
        expect(results[0].deadLetteredAt).toBeNull();
      } else {
        expect(results[0].status).toBe('dead_letter');
        expect(results[0].deadLetteredAt).toBeTruthy();
        expect(results[0].nextRetryAt).toBeNull();
      }
    }

    // Admin can replay the dead-lettered event and have it succeed
    const replayRes = await request(app)
      .post(`/api/events/${res2.body.eventId}/replay`)
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(replayRes.status).toBe(202);
    expect(replayRes.body.event.status).toBe('valid');

    await processPendingEvents();
    const replayedEvent = await Event.findById(res2.body.eventId);
    expect(replayedEvent.status).toBe('processed');
  });
});

