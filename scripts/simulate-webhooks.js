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
const ADMIN_EMAIL = process.env.ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const BOOTSTRAP_TOKEN = loadEnvValue('BOOTSTRAP_TOKEN');

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
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      'Set ADMIN_EMAIL and ADMIN_PASSWORD environment variables before running simulate-webhooks.js'
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
        name: 'Simulator Admin',
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

async function sendWebhook(source, scenario, payload, opts = {}) {
  const rawBody = JSON.stringify(payload);
  const ts = opts.timestampSec ?? Math.floor(Date.now() / 1000);
  const signed = signBody(source.signingSecret, rawBody, ts);
  const signature = opts.badSignature ? `sha256=${'f'.repeat(64)}` : signed.signature;
  const idempotencyKey = opts.idempotencyKey || `sim-${source.schemaType}-${crypto.randomUUID()}`;

  const res = await apiJson(`/webhooks/${source.id}`, {
    method: 'POST',
    headers: {
      'x-webhook-timestamp': signed.timestamp,
      'x-webhook-signature': signature,
      'x-idempotency-key': idempotencyKey,
    },
    body: rawBody,
  });

  return {
    source: source.name,
    scenario,
    status: res.status,
    outcome: res.data.duplicate
      ? 'duplicate'
      : res.data.status || res.data.error?.code || 'unknown',
    eventId: res.data.eventId || '-',
  };
}

async function main() {
  console.log(`Target API: ${API_BASE}`);
  const token = await authenticateAdmin();

  const sourceSpecs = [
    { name: 'Web Form Leads', schemaType: 'web_form', description: 'Marketing landing page forms' },
    { name: 'CRM Deals', schemaType: 'crm', description: 'Sales pipeline deal updates' },
    { name: 'Partner Orders', schemaType: 'partner', description: 'B2B partner order feed' },
  ];

  const sources = {};
  for (const spec of sourceSpecs) {
    const src = await ensureSource(token, spec);
    sources[spec.schemaType] = src;
    console.log(`Ready source: ${src.name} (${src.id}, schema=${src.schemaType})`);
  }

  const runId = Date.now().toString(36);
  const results = [];

  // 1. Valid events across all 3 sources
  results.push(
    await sendWebhook(sources.web_form, 'valid_web_form', {
      submissionId: `wf-${runId}-1`,
      fullName: 'Elena Vance',
      email: 'elena.vance@northstar.test',
      company: 'Northstar Logistics',
      topic: 'enterprise_onboarding',
      tags: ['inbound', 'enterprise'],
    })
  );

  results.push(
    await sendWebhook(sources.crm, 'valid_crm', {
      contactId: `crm-${runId}-1`,
      name: 'Marcus Chen',
      email: 'm.chen@apexglobal.test',
      accountName: 'Apex Global',
      stage: 'closed_won',
      dealValue: 48500,
      currency: 'USD',
    })
  );

  results.push(
    await sendWebhook(sources.partner, 'valid_partner', {
      partnerRef: `prt-${runId}-1`,
      customer: {
        name: 'Priya Nair',
        email: 'priya@horizoncloud.test',
        organization: 'Horizon Cloud',
      },
      items: [
        { sku: 'WORKFLOW-ENT', quantity: 2, unitPrice: 1200 },
        { sku: 'AUDIT-ADDON', quantity: 1, unitPrice: 450 },
      ],
      currency: 'USD',
    })
  );

  // 2. Malformed payloads (schema validation failures -> 422 invalid)
  results.push(
    await sendWebhook(sources.web_form, 'malformed_web_form_bad_email', {
      submissionId: `wf-${runId}-bad`,
      fullName: 'Invalid User',
      email: 'not-an-email',
    })
  );

  results.push(
    await sendWebhook(sources.partner, 'malformed_partner_empty_items', {
      partnerRef: `prt-${runId}-bad`,
      customer: { name: 'Empty Items', email: 'empty@partner.test' },
      items: [],
    })
  );

  // 3. Duplicate idempotency key deliveries (first 202, second 200 duplicate)
  const dupKey = `sim-dup-${runId}`;
  const crmDupPayload = {
    contactId: `crm-${runId}-dup`,
    name: 'Sofia Patel',
    email: 'sofia@vanguard.test',
    accountName: 'Vanguard Systems',
    stage: 'negotiation',
    dealValue: 19000,
    currency: 'USD',
  };
  results.push(
    await sendWebhook(sources.crm, 'duplicate_first_delivery', crmDupPayload, {
      idempotencyKey: dupKey,
    })
  );
  results.push(
    await sendWebhook(sources.crm, 'duplicate_second_delivery', crmDupPayload, {
      idempotencyKey: dupKey,
    })
  );

  // 4. Badly signed & stale timestamp events (-> 401)
  results.push(
    await sendWebhook(
      sources.web_form,
      'bad_hmac_signature',
      {
        submissionId: `wf-${runId}-badsig`,
        fullName: 'Bad Sig',
        email: 'badsig@example.test',
      },
      { badSignature: true }
    )
  );

  results.push(
    await sendWebhook(
      sources.crm,
      'stale_timestamp_replay',
      {
        contactId: `crm-${runId}-stale`,
        name: 'Stale Event',
        email: 'stale@example.test',
        stage: 'qualified',
        dealValue: 5000,
      },
      { timestampSec: Math.floor(Date.now() / 1000) - 900 }
    )
  );

  console.log('\nSimulation Results:');
  console.table(results);

  const summary = results.reduce((acc, r) => {
    const key = `${r.status} (${r.outcome})`;
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  console.log('Summary:', summary);
}

main().catch((err) => {
  console.error('Simulator error:', err.message);
  process.exit(1);
});
