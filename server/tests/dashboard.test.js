import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createTestUser, getApp } from './helpers.js';
import { Event } from '../src/models/Event.js';
import { RecordModel } from '../src/models/Record.js';
import { Source } from '../src/models/Source.js';
import { encryptSecret, sha256Hex } from '../src/utils/crypto.js';

function assertNoSecretsInJson(payload) {
  const serialized = JSON.stringify(payload);
  expect(serialized).not.toContain('apiKeyHash');
  expect(serialized).not.toContain('signingSecretEncrypted');
  expect(serialized).not.toContain('signingSecretHash');
  expect(serialized).not.toContain('signingSecret');
  expect(serialized).not.toContain('passwordHash');
}

describe('Phase 4 Dashboard API, Aggregations, Filters, Pagination & Secret Redaction', () => {
  async function seedDashboardData(adminToken) {
    const s1 = await Source.create({
      name: 'Web Forms',
      schemaType: 'web_form',
      apiKeyHash: sha256Hex('wpk_test1'),
      apiKeyPrefix: 'wpk_test1',
      signingSecretHash: sha256Hex('whsec_test1'),
      signingSecretEncrypted: encryptSecret('whsec_test1'),
      active: true,
    });

    const s2 = await Source.create({
      name: 'Partner Feed',
      schemaType: 'partner',
      apiKeyHash: sha256Hex('wpk_test2'),
      apiKeyPrefix: 'wpk_test2',
      signingSecretHash: sha256Hex('whsec_test2'),
      signingSecretEncrypted: encryptSecret('whsec_test2'),
      active: true,
    });

    const day1 = new Date('2026-11-10T10:00:00.000Z');
    const day2 = new Date('2026-11-11T14:30:00.000Z');

    const ev1 = await Event.create({
      sourceId: s1._id,
      payload: { submissionId: 's-1', fullName: 'Alice (VIP)', email: 'alice+vip@acme.test' },
      status: 'processed',
      idempotencyKey: 'key-1',
      receivedAt: day1,
      processedAt: new Date(day1.getTime() + 120),
      processingLogs: [{ timestamp: day1, stage: 'process', level: 'info', message: 'Done' }],
    });

    const rec1 = await RecordModel.create({
      sourceId: s1._id,
      eventId: ev1._id,
      externalId: 's-1',
      clientName: 'Alice (VIP)',
      clientEmail: 'alice+vip@acme.test',
      company: 'Acme [North]',
      category: 'enterprise',
      amount: 1500,
      normalizedAt: day1,
    });
    ev1.recordId = rec1._id;
    await ev1.save();

    const ev2 = await Event.create({
      sourceId: s2._id,
      payload: { partnerRef: 'p-2', customer: { name: 'Bob Builder', email: 'bob@build.test' } },
      status: 'invalid',
      errors: [{ field: 'items', message: 'Items cannot be empty', code: 'too_small' }],
      idempotencyKey: 'key-2',
      receivedAt: day2,
      processingLogs: [{ timestamp: day2, stage: 'validate', level: 'warn', message: 'Invalid' }],
    });

    const ev3 = await Event.create({
      sourceId: s2._id,
      payload: { partnerRef: 'p-3', customer: { name: 'Cara Lee', email: 'cara@lee.test' } },
      status: 'dead_letter',
      idempotencyKey: 'key-3',
      attempts: 3,
      maxAttempts: 3,
      receivedAt: day2,
      deadLetteredAt: day2,
    });

    const ev4 = await Event.create({
      sourceId: s1._id,
      payload: { submissionId: 's-4', fullName: 'Dan Reed', email: 'dan@reed.test' },
      status: 'failed',
      idempotencyKey: 'key-4',
      attempts: 1,
      maxAttempts: 3,
      receivedAt: day2,
    });

    const app = getApp();
    await request(app)
      .patch(`/api/sources/${s2._id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'Updated partner feed' });

    return { s1, s2, ev1, ev2, ev3, ev4, rec1 };
  }

  it('computes summary and time-series metrics via MongoDB aggregations with date and source filters', async () => {
    const app = getApp();
    const admin = await createTestUser({ email: 'admin@example.com', role: 'admin' });
    const viewer = await createTestUser({ email: 'viewer@example.com', role: 'viewer' });
    const { s1 } = await seedDashboardData(admin.accessToken);

    const summaryAll = await request(app)
      .get('/api/metrics/summary')
      .set('Authorization', `Bearer ${viewer.accessToken}`);

    expect(summaryAll.status).toBe(200);
    expect(summaryAll.body.total).toBe(4);
    expect(summaryAll.body.counts.processed).toBe(1);
    expect(summaryAll.body.counts.invalid).toBe(1);
    expect(summaryAll.body.counts.dead_letter).toBe(1);
    expect(summaryAll.body.counts.failed).toBe(1);
    expect(summaryAll.body.successRate).toBe(25);
    expect(summaryAll.body.avgProcessingMs).toBe(120);
    expect(summaryAll.body.bySource).toHaveLength(2);
    assertNoSecretsInJson(summaryAll.body);

    const summaryFiltered = await request(app)
      .get(`/api/metrics/summary?sourceId=${s1._id}&from=2026-11-10&to=2026-11-10`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);
    expect(summaryFiltered.status).toBe(200);
    expect(summaryFiltered.body.total).toBe(1);
    expect(summaryFiltered.body.counts.processed).toBe(1);

    const tsDay = await request(app)
      .get('/api/metrics/timeseries?granularity=day')
      .set('Authorization', `Bearer ${viewer.accessToken}`);
    expect(tsDay.status).toBe(200);
    expect(tsDay.body.buckets).toEqual([
      expect.objectContaining({ bucket: '2026-11-10', total: 1, processed: 1 }),
      expect.objectContaining({ bucket: '2026-11-11', total: 3, invalid: 1, failed: 1, dead_letter: 1 }),
    ]);

    const tsHour = await request(app)
      .get('/api/metrics/timeseries?granularity=hour&from=2026-11-11&to=2026-11-11')
      .set('Authorization', `Bearer ${viewer.accessToken}`);
    expect(tsHour.status).toBe(200);
    expect(tsHour.body.buckets[0].bucket).toBe('2026-11-11T14:00:00Z');
  });

  it('filters events and records safely with escaped search, strict allowlists, and capped pagination', async () => {
    const app = getApp();
    const admin = await createTestUser({ email: 'admin@example.com', role: 'admin' });
    const viewer = await createTestUser({ email: 'viewer@example.com', role: 'viewer' });
    const { s1, ev1 } = await seedDashboardData(admin.accessToken);

    // Unknown filter key rejected by Zod .strict()
    const badFilter = await request(app)
      .get('/api/events?unknownField=1')
      .set('Authorization', `Bearer ${viewer.accessToken}`);
    expect(badFilter.status).toBe(400);
    expect(badFilter.body.error.code).toBe('VALIDATION_ERROR');

    // Pagination capped at 100
    const overLimit = await request(app)
      .get('/api/events?limit=101')
      .set('Authorization', `Bearer ${viewer.accessToken}`);
    expect(overLimit.status).toBe(400);

    // Filter events by status & source
    const filteredEvents = await request(app)
      .get(`/api/events?status=processed&sourceId=${s1._id}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);
    expect(filteredEvents.status).toBe(200);
    expect(filteredEvents.body.items).toHaveLength(1);
    expect(filteredEvents.body.items[0].source.name).toBe('Web Forms');
    assertNoSecretsInJson(filteredEvents.body);

    // Search containing regex metacharacters (e.g. "(VIP)" or ".*") is escaped safely
    const metacharSearch = await request(app)
      .get(`/api/events?search=${encodeURIComponent('(VIP)')}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);
    expect(metacharSearch.status).toBe(200);
    expect(metacharSearch.body.items).toHaveLength(1);

    const wildcardInjection = await request(app)
      .get(`/api/records?search=${encodeURIComponent('.*')}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);
    expect(wildcardInjection.status).toBe(200);
    expect(wildcardInjection.body.items).toHaveLength(0);

    const recordMatch = await request(app)
      .get(`/api/records?search=${encodeURIComponent('Acme [North]')}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);
    expect(recordMatch.status).toBe(200);
    expect(recordMatch.body.items).toHaveLength(1);
    expect(recordMatch.body.items[0].clientEmail).toBe('alice+vip@acme.test');
    assertNoSecretsInJson(recordMatch.body);

    // Event detail includes processingLogs & populated recordId without secrets
    const detail = await request(app)
      .get(`/api/events/${ev1._id}`)
      .set('Authorization', `Bearer ${viewer.accessToken}`);
    expect(detail.status).toBe(200);
    expect(detail.body.event.processingLogs).toHaveLength(1);
    expect(detail.body.event.recordId.clientName).toBe('Alice (VIP)');
    assertNoSecretsInJson(detail.body);

    // Audit logs endpoint is admin-only (manager and viewer denied with 403)
    const manager = await createTestUser({ email: 'manager@example.com', role: 'manager' });
    const viewerAudit = await request(app)
      .get('/api/audit-logs?action=source.update')
      .set('Authorization', `Bearer ${viewer.accessToken}`);
    expect(viewerAudit.status).toBe(403);

    const managerAudit = await request(app)
      .get('/api/audit-logs?action=source.update')
      .set('Authorization', `Bearer ${manager.accessToken}`);
    expect(managerAudit.status).toBe(403);

    const audits = await request(app)
      .get('/api/audit-logs?action=source.update')
      .set('Authorization', `Bearer ${admin.accessToken}`);
    expect(audits.status).toBe(200);
    expect(audits.body.items).toHaveLength(1);
    assertNoSecretsInJson(audits.body);
  });

  it('never leaks apiKeyHash, signing secrets, or passwordHash on source and user endpoints', async () => {
    const app = getApp();
    const admin = await createTestUser({ email: 'admin@example.com', role: 'admin' });
    const viewer = await createTestUser({ email: 'viewer@example.com', role: 'viewer' });
    const { s1 } = await seedDashboardData(admin.accessToken);

    const endpoints = [
      { method: 'get', path: '/api/sources', token: viewer.accessToken },
      { method: 'get', path: `/api/sources/${s1._id}`, token: viewer.accessToken },
      { method: 'patch', path: `/api/sources/${s1._id}`, token: admin.accessToken, body: { active: true } },
      { method: 'get', path: '/api/users', token: admin.accessToken },
      { method: 'get', path: `/api/users/${viewer.user._id}`, token: admin.accessToken },
      { method: 'patch', path: `/api/users/${viewer.user._id}`, token: admin.accessToken, body: { name: 'Updated Viewer' } },
    ];

    for (const ep of endpoints) {
      const req = request(app)[ep.method](ep.path).set('Authorization', `Bearer ${ep.token}`);
      const res = ep.body ? await req.send(ep.body) : await req;
      expect(res.status).toBe(200);
      assertNoSecretsInJson(res.body);
    }
  });
});

