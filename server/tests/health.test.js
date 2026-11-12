import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { getApp } from './helpers.js';
import {
  genericWebhookPayloadSchema,
  partnerWebhookPayloadSchema,
} from '../src/validators/webhookValidators.js';

describe('Core App, Health & Payload Limits', () => {
  it('returns 200 on GET /api/health when MongoDB is connected', async () => {
    const app = getApp();
    const res = await request(app).get('/api/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.database).toBe('connected');
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });

  it('returns 404 JSON on unknown routes', async () => {
    const app = getApp();
    const res = await request(app).get('/api/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('rejects oversized JSON request body (>100kb) with 413 PAYLOAD_TOO_LARGE', async () => {
    const app = getApp();
    const oversizedString = 'a'.repeat(120 * 1024);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@example.com', password: oversizedString });

    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rejects oversized field strings in request validation with 400 VALIDATION_ERROR', async () => {
    const app = getApp();
    const res = await request(app)
      .post('/api/auth/register')
      .set('x-bootstrap-token', process.env.BOOTSTRAP_TOKEN)
      .send({
        name: 'n'.repeat(121),
        email: 'admin@example.com',
        password: 'StrongPassword123!',
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('enforces explicit max lengths on webhook payload strings and arrays', () => {
    const tooManyTags = Array.from({ length: 21 }, (_, i) => `tag-${i}`);
    const tagResult = genericWebhookPayloadSchema.safeParse({
      clientName: 'Acme Corp',
      tags: tooManyTags,
    });
    expect(tagResult.success).toBe(false);

    const longNameResult = genericWebhookPayloadSchema.safeParse({
      clientName: 'x'.repeat(161),
    });
    expect(longNameResult.success).toBe(false);

    const tooManyItems = Array.from({ length: 101 }, (_, i) => ({
      sku: `SKU-${i}`,
      quantity: 1,
      unitPrice: 10,
    }));
    const partnerResult = partnerWebhookPayloadSchema.safeParse({
      partnerRef: 'ref-1',
      customer: { name: 'Alice', email: 'alice@example.com' },
      items: tooManyItems,
    });
    expect(partnerResult.success).toBe(false);
  });
});

