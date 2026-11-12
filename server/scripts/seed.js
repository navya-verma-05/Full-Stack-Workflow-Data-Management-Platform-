import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { env } from '../src/config/env.js';
import { User } from '../src/models/User.js';
import { Source } from '../src/models/Source.js';
import { Event } from '../src/models/Event.js';
import { RecordModel } from '../src/models/Record.js';
import { AuditLog } from '../src/models/AuditLog.js';
import { SystemLock } from '../src/models/SystemLock.js';
import { RefreshToken } from '../src/models/RefreshToken.js';
import { encryptSecret, generateSecret, sha256Hex } from '../src/utils/crypto.js';

const COMPANIES = [
  'Northstar Logistics',
  'Apex Global',
  'Horizon Cloud',
  'Vanguard Systems',
  'Meridian Health',
  'Cobalt Robotics',
  'Solstice Energy',
  'Atlas FinTech',
  'Lumen Bio',
  'Crestline Retail',
];

const FIRST_NAMES = [
  'Elena',
  'Marcus',
  'Priya',
  'Sofia',
  'Liam',
  'Noah',
  'Maya',
  'Owen',
  'Aria',
  'Julian',
  'Nadia',
  'Ethan',
];

const LAST_NAMES = [
  'Vance',
  'Chen',
  'Nair',
  'Patel',
  'OConnor',
  'Kim',
  'Silva',
  'Brooks',
  'Alvarez',
  'Sato',
  'Wright',
  'Meyer',
];

function randomPassword() {
  return `Wp!${crypto.randomBytes(10).toString('base64url')}9`;
}

function pick(arr, idx) {
  return arr[idx % arr.length];
}

async function seed() {
  const args = new Set(process.argv.slice(2));
  const shouldReset = args.has('--reset');
  const forceProd = args.has('--force');

  if (env.NODE_ENV === 'production' && !forceProd) {
    throw new Error('Refusing to run seed in production without --force');
  }

  await connectDB();

  const existingUsers = await User.countDocuments();
  if (existingUsers > 0 && !shouldReset) {
    console.log('Database already contains users. Pass --reset to wipe and reseed.');
    await disconnectDB();
    return;
  }

  if (shouldReset) {
    await Promise.all([
      User.deleteMany({}),
      Source.deleteMany({}),
      Event.deleteMany({}),
      RecordModel.deleteMany({}),
      AuditLog.deleteMany({}),
      SystemLock.deleteMany({}),
      RefreshToken.deleteMany({}),
    ]);
    console.log('Cleared existing collections.');
  }

  const credentialsToPrint = [];
  const userSpecs = [
    {
      name: 'Platform Admin',
      email: process.env.SEED_ADMIN_EMAIL || 'admin@workflow.local',
      password: process.env.SEED_ADMIN_PASSWORD || randomPassword(),
      source: process.env.SEED_ADMIN_PASSWORD ? 'env' : 'generated',
      role: 'admin',
    },
    {
      name: 'Operations Manager',
      email: process.env.SEED_MANAGER_EMAIL || 'manager@workflow.local',
      password: process.env.SEED_MANAGER_PASSWORD || randomPassword(),
      source: process.env.SEED_MANAGER_PASSWORD ? 'env' : 'generated',
      role: 'manager',
    },
    {
      name: 'Read-Only Viewer',
      email: process.env.SEED_VIEWER_EMAIL || 'viewer@workflow.local',
      password: process.env.SEED_VIEWER_PASSWORD || randomPassword(),
      source: process.env.SEED_VIEWER_PASSWORD ? 'env' : 'generated',
      role: 'viewer',
    },
  ];

  const createdUsers = {};
  for (const spec of userSpecs) {
    const passwordHash = await bcrypt.hash(spec.password, 10);
    const user = await User.create({
      name: spec.name,
      email: spec.email,
      passwordHash,
      role: spec.role,
      active: true,
    });
    createdUsers[spec.role] = user;
    credentialsToPrint.push({
      role: spec.role,
      email: spec.email,
      password: spec.password,
      origin: spec.source,
    });
  }

  await SystemLock.create({ _id: 'bootstrap_admin' });

  const sourceSpecs = [
    {
      name: 'Web Form Leads',
      description: 'Inbound enterprise contact and demo request forms',
      schemaType: 'web_form',
      active: true,
    },
    {
      name: 'CRM Deals',
      description: 'Real-time sales pipeline stage updates from CRM',
      schemaType: 'crm',
      active: true,
    },
    {
      name: 'Partner Orders',
      description: 'B2B partner fulfillment and license order webhooks',
      schemaType: 'partner',
      active: true,
    },
  ];

  const sources = [];
  for (const spec of sourceSpecs) {
    const apiKey = generateSecret(24, 'wpk_');
    const signingSecret = generateSecret(32, 'whsec_');
    const src = await Source.create({
      ...spec,
      apiKeyHash: sha256Hex(apiKey),
      apiKeyPrefix: apiKey.slice(0, 10),
      signingSecretHash: sha256Hex(signingSecret),
      signingSecretEncrypted: encryptSecret(signingSecret),
      createdBy: createdUsers.admin._id,
    });
    sources.push(src);
  }

  const TOTAL_EVENTS = 240;
  const now = Date.now();
  const statusCounts = { processed: 0, invalid: 0, failed: 0, dead_letter: 0, valid: 0 };

  const eventsToInsert = [];
  const recordsToInsert = [];

  for (let i = 0; i < TOTAL_EVENTS; i += 1) {
    const src = sources[i % sources.length];
    const daysAgo = i % 14;
    const hourOffset = (i * 7) % 24;
    const receivedAt = new Date(
      now - daysAgo * 24 * 60 * 60 * 1000 - hourOffset * 60 * 60 * 1000 + (i % 55) * 60 * 1000
    );

    const first = pick(FIRST_NAMES, i);
    const last = pick(LAST_NAMES, i * 3 + 1);
    const fullName = `${first} ${last}`;
    const company = pick(COMPANIES, i * 3);
    const email = `${first.toLowerCase()}.${last.toLowerCase()}.${i}@${company
      .toLowerCase()
      .replace(/[^a-z]/g, '')}.test`;

    // Deterministic realistic status distribution
    const mod = i % 20;
    let status = 'processed';
    if (mod === 3 || mod === 11) status = 'invalid';
    else if (mod === 7) status = 'failed';
    else if (mod === 15) status = 'dead_letter';
    else if (mod === 19) status = 'valid';

    statusCounts[status] += 1;

    const eventId = new Source.base.Types.ObjectId();
    const recordId = status === 'processed' ? new Source.base.Types.ObjectId() : null;

    let payload;
    let normalized;
    if (src.schemaType === 'web_form') {
      payload = {
        submissionId: `wf-seed-${1000 + i}`,
        fullName,
        email: status === 'invalid' ? 'invalid-email' : email,
        company,
        topic: i % 2 === 0 ? 'enterprise_demo' : 'security_review',
        tags: ['inbound', i % 3 === 0 ? 'priority' : 'standard'],
      };
      normalized = {
        _id: recordId,
        sourceId: src._id,
        eventId,
        externalId: payload.submissionId,
        clientName: fullName,
        clientEmail: email,
        company,
        category: payload.topic,
        amount: 0,
        currency: 'USD',
        metadata: { tags: payload.tags },
        normalizedAt: new Date(receivedAt.getTime() + 180),
      };
    } else if (src.schemaType === 'crm') {
      const dealValue = 4500 + ((i * 1350) % 45000);
      payload = {
        contactId: `crm-seed-${2000 + i}`,
        name: fullName,
        email: status === 'invalid' ? 'bad@' : email,
        accountName: company,
        stage: i % 3 === 0 ? 'closed_won' : 'negotiation',
        dealValue,
        currency: 'USD',
      };
      normalized = {
        _id: recordId,
        sourceId: src._id,
        eventId,
        externalId: payload.contactId,
        clientName: fullName,
        clientEmail: email,
        company,
        category: payload.stage,
        amount: dealValue,
        currency: 'USD',
        metadata: { stage: payload.stage },
        normalizedAt: new Date(receivedAt.getTime() + 220),
      };
    } else {
      const qty = (i % 4) + 1;
      const unitPrice = 450 + ((i * 50) % 1200);
      payload = {
        partnerRef: `prt-seed-${3000 + i}`,
        customer: { name: fullName, email, organization: company },
        items: status === 'invalid' ? [] : [{ sku: `SUITE-${(i % 5) + 1}`, quantity: qty, unitPrice }],
        currency: 'USD',
      };
      normalized = {
        _id: recordId,
        sourceId: src._id,
        eventId,
        externalId: payload.partnerRef,
        clientName: fullName,
        clientEmail: email,
        company,
        category: 'partner_order',
        amount: qty * unitPrice,
        currency: 'USD',
        metadata: { itemCount: 1 },
        normalizedAt: new Date(receivedAt.getTime() + 260),
      };
    }

    const logs = [
      {
        timestamp: receivedAt,
        stage: 'ingest',
        level: 'info',
        message: 'Webhook HMAC signature verified and event accepted',
      },
    ];
    const errors = [];

    if (status === 'invalid') {
      errors.push({
        field: src.schemaType === 'partner' ? 'items' : 'email',
        message:
          src.schemaType === 'partner'
            ? 'Too small: expected array to have >=1 items'
            : 'Invalid email address',
        code: 'VALIDATION_ERROR',
      });
      logs.push({
        timestamp: new Date(receivedAt.getTime() + 15),
        stage: 'validate',
        level: 'warn',
        message: `Payload failed ${src.schemaType} schema validation`,
      });
    } else {
      logs.push({
        timestamp: new Date(receivedAt.getTime() + 15),
        stage: 'validate',
        level: 'info',
        message: `Payload validated against ${src.schemaType} schema`,
      });
    }

    if (status === 'processed') {
      logs.push({
        timestamp: new Date(receivedAt.getTime() + 180 + (i % 150)),
        stage: 'process',
        level: 'info',
        message: `Processed successfully into Record ${recordId}`,
      });
      recordsToInsert.push(normalized);
    } else if (status === 'failed') {
      logs.push({
        timestamp: new Date(receivedAt.getTime() + 120),
        stage: 'retry',
        level: 'warn',
        message: 'Attempt 1/4 failed (Downstream timeout); retry scheduled',
      });
    } else if (status === 'dead_letter') {
      logs.push({
        timestamp: new Date(receivedAt.getTime() + 120),
        stage: 'retry',
        level: 'warn',
        message: 'Attempt 1/4 failed (Downstream 503); retry scheduled',
      });
      logs.push({
        timestamp: new Date(receivedAt.getTime() + 3500),
        stage: 'dead_letter',
        level: 'error',
        message: 'Exhausted 4 attempts: Downstream 503 persistent error',
      });
    }

    eventsToInsert.push({
      _id: eventId,
      sourceId: src._id,
      payload,
      status,
      errors,
      processingLogs: logs,
      idempotencyKey: `seed-${src.schemaType}-${i}`,
      attempts: status === 'processed' ? 1 : status === 'failed' ? 1 : status === 'dead_letter' ? 4 : 0,
      maxAttempts: 4,
      nextRetryAt: status === 'failed' ? new Date(now + 60 * 60 * 1000) : status === 'valid' ? new Date(now + 60 * 60 * 1000) : null,
      deadLetteredAt: status === 'dead_letter' ? new Date(receivedAt.getTime() + 3500) : null,
      receivedAt,
      processedAt: status === 'processed' ? new Date(receivedAt.getTime() + 180 + (i % 150)) : null,
      recordId,
    });
  }

  await Event.insertMany(eventsToInsert);
  await RecordModel.insertMany(recordsToInsert);

  await AuditLog.insertMany([
    {
      actorId: createdUsers.admin._id,
      actorEmail: createdUsers.admin.email,
      actorRole: 'admin',
      action: 'auth.bootstrap_admin',
      resourceType: 'user',
      resourceId: String(createdUsers.admin._id),
      metadata: { role: 'admin' },
      createdAt: new Date(now - 14 * 24 * 60 * 60 * 1000),
    },
    ...sources.map((s, idx) => ({
      actorId: createdUsers.admin._id,
      actorEmail: createdUsers.admin.email,
      actorRole: 'admin',
      action: 'source.create',
      resourceType: 'source',
      resourceId: String(s._id),
      metadata: { name: s.name, schemaType: s.schemaType },
      createdAt: new Date(now - (13 - idx) * 24 * 60 * 60 * 1000),
    })),
    {
      actorId: createdUsers.manager._id,
      actorEmail: createdUsers.manager.email,
      actorRole: 'manager',
      action: 'event.replay',
      resourceType: 'event',
      resourceId: String(eventsToInsert[0]._id),
      metadata: { previousStatus: 'dead_letter' },
      createdAt: new Date(now - 2 * 60 * 60 * 1000),
    },
  ]);

  console.log('\nSeed completed successfully!');
  console.log('Seeded Users (save these credentials; generated passwords are shown once):');
  console.table(credentialsToPrint);
  console.log('Seeded Sources:', sources.map((s) => `${s.name} (${s.schemaType})`).join(', '));
  console.log('Seeded Events:', TOTAL_EVENTS, statusCounts);
  console.log('Seeded Records:', recordsToInsert.length);

  await disconnectDB();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
