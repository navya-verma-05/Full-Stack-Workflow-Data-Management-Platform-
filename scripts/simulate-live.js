import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnvValue(key) {
  if (process.env[key]) return process.env[key];
  const envPath = path.resolve(__dirname, '../server/.env');
  if (!fs.existsSync(envPath)) return undefined;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    if (k === key) return v;
  }
  return undefined;
}

const API_BASE = process.env.API_URL || `http://localhost:${loadEnvValue('PORT') || 4000}/api`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || loadEnvValue('SEED_ADMIN_EMAIL') || 'admin@workflow.local';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || loadEnvValue('SEED_ADMIN_PASSWORD');
const BOOTSTRAP_TOKEN = loadEnvValue('BOOTSTRAP_TOKEN');
const INTERVAL_MS = Number(process.env.SIMULATE_INTERVAL_MS || 2500);

function signBody(signingSecret, rawBody, timestampSec = Math.floor(Date.now() / 1000)) {
  const mac = crypto
    .createHmac('sha256', signingSecret)
    .update(`${timestampSec}.${rawBody}`)
    .digest('hex');
  return {
    timestamp: String(timestampSec),
    signature: `sha256=${mac}`,
  };
}

async function apiJson(pathname, { method = 'GET', token, headers = {}, body } = {}) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let json = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { status: res.status, data: json };
}

async function authenticateAdmin() {
  if (!ADMIN_PASSWORD) {
    throw new Error(
      'Set ADMIN_PASSWORD (or SEED_ADMIN_PASSWORD in server/.env) to run the live simulator.'
    );
  }

  const loginRes = await apiJson('/auth/login', {
    method: 'POST',
    body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
  if (loginRes.status === 200) {
    return loginRes.data.accessToken;
  }

  if (BOOTSTRAP_TOKEN) {
    const regRes = await apiJson('/auth/register', {
      method: 'POST',
      headers: { 'x-bootstrap-token': BOOTSTRAP_TOKEN },
      body: {
        name: 'Live Simulator Admin',
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        role: 'admin',
      },
    });
    if (regRes.status === 201) {
      return regRes.data.accessToken;
    }
  }

  throw new Error(
    `Failed to authenticate admin (${loginRes.status}): ${JSON.stringify(loginRes.data)}`
  );
}

async function ensureSource(token, spec) {
  const createRes = await apiJson('/sources', {
    method: 'POST',
    token,
    body: spec,
  });

  if (createRes.status === 201) {
    return {
      id: createRes.data.source._id,
      name: createRes.data.source.name,
      schemaType: createRes.data.source.schemaType,
      signingSecret: createRes.data.credentials.signingSecret,
    };
  }

  if (createRes.status === 409) {
    const listRes = await apiJson('/sources?limit=50', { token });
    const existing = (listRes.data.items || []).find((s) => s.name === spec.name);
    if (!existing) {
      throw new Error(`Source ${spec.name} conflicted but was not found in list`);
    }
    const rotateRes = await apiJson(`/sources/${existing._id}/rotate-secret`, {
      method: 'POST',
      token,
    });
    if (rotateRes.status !== 200) {
      throw new Error(`Failed to rotate secret for ${spec.name}: ${rotateRes.status}`);
    }
    return {
      id: existing._id,
      name: existing.name,
      schemaType: existing.schemaType,
      signingSecret: rotateRes.data.signingSecret,
    };
  }

  throw new Error(`Failed to create source ${spec.name}: ${createRes.status}`);
}

const SOURCES_DEF = [
  {
    name: 'Live Web Form Leads',
    description: 'Continuous simulated inbound contact forms for demo streaming',
    schemaType: 'web_form',
  },
  {
    name: 'Live CRM Pipeline Sync',
    description: 'Continuous simulated CRM opportunity transitions for demo streaming',
    schemaType: 'crm',
  },
  {
    name: 'Live Partner Order Stream',
    description: 'Continuous simulated wholesale purchase orders for demo streaming',
    schemaType: 'partner',
  },
];

const COMPANIES = [
  'Acme Corp', 'Globex', 'Soylent Inc', 'Initech', 'Umbrella Co',
  'Hooli', 'Pied Piper', 'Cyberdyne', 'Massive Dynamic', 'Stark Industries'
];

const NAMES = [
  'Alice Chen', 'Bob Smith', 'Elena Rostova', 'David Kim', 'Fatima Zahra',
  'Carlos Santana', 'Hannah Abbott', 'Kenji Sato', 'Maya Patel', 'Liam O Connor'
];

let counter = 0;

function generateEvent(source) {
  counter += 1;
  const name = NAMES[Math.floor(Math.random() * NAMES.length)];
  const company = COMPANIES[Math.floor(Math.random() * COMPANIES.length)];
  const emailName = name.toLowerCase().replace(/[^a-z]/g, '.');
  const validEmail = `${emailName}@${company.toLowerCase().replace(/[^a-z]/g, '')}.com`;

  // 80% valid processed, 12% schema invalid, 8% bad signature
  const roll = Math.random();
  let badSignature = false;
  let payload;

  if (roll < 0.08) {
    badSignature = true;
  }

  if (source.schemaType === 'web_form') {
    const isInvalid = roll >= 0.08 && roll < 0.20;
    payload = {
      submissionId: `wf-live-${Date.now()}-${counter}`,
      fullName: name,
      email: isInvalid ? 'not-an-email' : validEmail,
      company,
      jobTitle: 'VP Technology',
      topic: 'enterprise_evaluation',
      tags: ['live_demo', 'inbound'],
    };
  } else if (source.schemaType === 'crm') {
    const isInvalid = roll >= 0.08 && roll < 0.20;
    payload = {
      contactId: `crm-live-${Date.now()}-${counter}`,
      name,
      email: isInvalid ? 'bad_email@' : validEmail,
      accountName: company,
      stage: 'negotiation',
      dealValue: 12500 + Math.floor(Math.random() * 50000),
      currency: 'USD',
      ownerRole: 'Director of Growth',
    };
  } else {
    const isInvalid = roll >= 0.08 && roll < 0.20;
    payload = {
      partnerRef: `po-live-${Date.now()}-${counter}`,
      customer: {
        name,
        email: validEmail,
        organization: company,
      },
      items: isInvalid ? [] : [
        { sku: 'SKU-CORE-500', quantity: 4, unitPrice: 120 },
        { sku: 'SKU-ENTERPRISE-PRO', quantity: 1, unitPrice: 2400 },
      ],
      currency: 'USD',
      region: 'us-east',
    };
  }

  return { payload, badSignature };
}

async function main() {
  console.log('='.repeat(70));
  console.log('Workflow Platform -- Live Ingestion Simulator');
  console.log(`Target API: ${API_BASE}`);
  console.log(`Interval:   ${INTERVAL_MS}ms per event`);
  console.log('Press Ctrl+C to terminate.');
  console.log('='.repeat(70));

  let token;
  try {
    token = await authenticateAdmin();
    console.log(`[AUTH] Authenticated as ${ADMIN_EMAIL}`);
  } catch (err) {
    console.error(`[AUTH_ERROR] ${err.message}`);
    process.exit(1);
  }

  console.log('[SOURCES] Initializing 3 simulated ingestion endpoints...');
  const sources = [];
  for (const def of SOURCES_DEF) {
    const s = await ensureSource(token, def);
    sources.push(s);
    console.log(`  - ${s.name} (${s.schemaType}): ${s.id}`);
  }

  console.log('[STREAM] Starting continuous webhook loop...\n');

  let active = true;
  process.on('SIGINT', () => {
    console.log('\n[STOP] Termination signal received. Stopping simulator...');
    active = false;
    process.exit(0);
  });

  let index = 0;
  while (active) {
    const source = sources[index % sources.length];
    index += 1;

    const { payload, badSignature } = generateEvent(source);
    const rawBody = JSON.stringify(payload);
    const tsSec = Math.floor(Date.now() / 1000);
    const signed = signBody(source.signingSecret, rawBody, tsSec);
    const signature = badSignature ? `sha256=${'0'.repeat(64)}` : signed.signature;
    const idempotencyKey = `live-${source.schemaType}-${Date.now()}-${counter}`;

    const start = Date.now();
    try {
      const res = await apiJson(`/webhooks/${source.id}`, {
        method: 'POST',
        headers: {
          'x-webhook-timestamp': signed.timestamp,
          'x-webhook-signature': signature,
          'x-idempotency-key': idempotencyKey,
        },
        body: rawBody,
      });
      const durationMs = Date.now() - start;
      const timeStr = new Date().toISOString().slice(11, 19);

      const statusTag = res.status === 201 ? '201 CREATED' :
                        res.status === 200 ? '200 OK' :
                        res.status === 422 ? '422 INVALID' :
                        res.status === 401 ? '401 BAD_SIG' :
                        `${res.status} ERR`;

      console.log(`[${timeStr}] [${source.schemaType.padEnd(8)}] ${statusTag.padEnd(12)} (${durationMs}ms) key=${idempotencyKey}`);
    } catch (err) {
      console.error(`[STREAM_ERROR] ${err.message}`);
    }

    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});

