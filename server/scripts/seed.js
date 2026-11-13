import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { connectDB, disconnectDB } from "../src/config/db.js";
import { env } from "../src/config/env.js";
import { User } from "../src/models/User.js";
import { Source } from "../src/models/Source.js";
import { Event } from "../src/models/Event.js";
import { RecordModel } from "../src/models/Record.js";
import { AuditLog } from "../src/models/AuditLog.js";
import { SystemLock } from "../src/models/SystemLock.js";
import { RefreshToken } from "../src/models/RefreshToken.js";
import {
  encryptSecret,
  generateSecret,
  sha256Hex,
} from "../src/utils/crypto.js";

function createRng(seedValue = 20261112) {
  let a = seedValue >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ACCOUNTS = [
  {
    company: "Northstar Logistics",
    domain: "northstarlogistics.io",
    baseAmount: 18500,
  },
  {
    company: "Apex Global Freight",
    domain: "apexfreight.com",
    baseAmount: 32400,
  },
  {
    company: "Horizon Cloud Systems",
    domain: "horizoncloud.dev",
    baseAmount: 24750,
  },
  { company: "Vanguard BioLabs", domain: "vanguardbio.org", baseAmount: 48200 },
  {
    company: "Meridian Health Network",
    domain: "meridianhealth.net",
    baseAmount: 64900,
  },
  {
    company: "Cobalt Robotics",
    domain: "cobaltrobotics.ai",
    baseAmount: 41600,
  },
  {
    company: "Solstice Clean Energy",
    domain: "solsticeenergy.co",
    baseAmount: 29300,
  },
  {
    company: "Atlas Treasury Tech",
    domain: "atlastreasury.com",
    baseAmount: 53800,
  },
  {
    company: "Lumen Retail Group",
    domain: "lumenretail.com",
    baseAmount: 14950,
  },
  {
    company: "Crestline Manufacturing",
    domain: "crestlinemfg.com",
    baseAmount: 37400,
  },
  {
    company: "Silverline Aviation",
    domain: "silverlineaero.com",
    baseAmount: 78500,
  },
  { company: "Redwood Security", domain: "redwoodsec.io", baseAmount: 44100 },
  { company: "Boreal Analytics", domain: "borealdata.ai", baseAmount: 19800 },
  {
    company: "Harborview Insurance",
    domain: "harborviewins.com",
    baseAmount: 58600,
  },
  {
    company: "Pacific Grid Corp",
    domain: "pacificgrid.com",
    baseAmount: 71200,
  },
  {
    company: "Keystone Construction",
    domain: "keystonebuild.com",
    baseAmount: 26450,
  },
  {
    company: "Monarch Pharmaceuticals",
    domain: "monarchpharma.org",
    baseAmount: 89400,
  },
  {
    company: "Cascadia Timber & Supply",
    domain: "cascadiasupply.com",
    baseAmount: 16300,
  },
];

const PEOPLE = [
  { first: "Elena", last: "Rostova", title: "VP Operations" },
  { first: "Marcus", last: "Chen", title: "Head of Platform" },
  { first: "Priya", last: "Subramanian", title: "Director of IT" },
  { first: "Sofia", last: "Mendoza", title: "RevOps Lead" },
  { first: "Liam", last: "OConnor", title: "Enterprise Architect" },
  { first: "Noah", last: "Lindqvist", title: "Procurement Director" },
  { first: "Maya", last: "Desai", title: "Staff Data Engineer" },
  { first: "Owen", last: "Kowalski", title: "VP Finance" },
  { first: "Aria", last: "Takahashi", title: "Security Compliance Lead" },
  { first: "Julian", last: "Mercer", title: "Solutions Director" },
  { first: "Nadia", last: "Al-Mansoor", title: "Supply Chain Manager" },
  { first: "Ethan", last: "Bauer", title: "Principal Systems Lead" },
  { first: "Hannah", last: "Vermeer", title: "Director of Partnerships" },
  { first: "Devon", last: "Callahan", title: "Technical Program Manager" },
  { first: "Keiko", last: "Watanabe", title: "Head of Integrations" },
  { first: "Mateo", last: "Silva", title: "Cloud Infrastructure Lead" },
  { first: "Clara", last: "Novak", title: "Chief Information Officer" },
  { first: "Tariq", last: "Hassan", title: "Commercial Ops Manager" },
];

const WEB_TOPICS = [
  "enterprise_demo",
  "security_review",
  "custom_pricing",
  "architecture_briefing",
];
const CRM_STAGES = [
  "qualification",
  "security_review",
  "negotiation",
  "closed_won",
  "expansion",
];
const PARTNER_SKUS = [
  { sku: "ENT-CORE-500", unitPrice: 1290 },
  { sku: "DATA-SYNC-PRO", unitPrice: 840 },
  { sku: "AUDIT-SHIELD-ADDON", unitPrice: 620 },
  { sku: "DEDICATED-INGEST", unitPrice: 1750 },
];

function randomPassword() {
  return `Sec#${crypto.randomBytes(10).toString("base64url")}9`;
}

async function seed() {
  const args = new Set(process.argv.slice(2));
  const shouldReset = args.has("--reset");
  const forceProd = args.has("--force");

  if (env.NODE_ENV === "production" && !forceProd) {
    throw new Error("Refusing to run seed in production without --force");
  }

  await connectDB();

  const existingUsers = await User.countDocuments();
  if (existingUsers > 0 && !shouldReset) {
    console.log(
      "Database already contains users. Pass --reset to wipe and reseed.",
    );
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
    console.log("Cleared existing collections.");
  }

  const credentialsToPrint = [];
  const userSpecs = [
    {
      name: "Platform Admin",
      email: process.env.SEED_ADMIN_EMAIL || "admin@workflow.local",
      password: process.env.SEED_ADMIN_PASSWORD || randomPassword(),
      source: process.env.SEED_ADMIN_PASSWORD ? "env" : "generated",
      role: "admin",
    },
    {
      name: "Operations Manager",
      email: process.env.SEED_MANAGER_EMAIL || "manager@workflow.local",
      password: process.env.SEED_MANAGER_PASSWORD || randomPassword(),
      source: process.env.SEED_MANAGER_PASSWORD ? "env" : "generated",
      role: "manager",
    },
    {
      name: "Read-Only Viewer",
      email: process.env.SEED_VIEWER_EMAIL || "viewer@workflow.local",
      password: process.env.SEED_VIEWER_PASSWORD || randomPassword(),
      source: process.env.SEED_VIEWER_PASSWORD ? "env" : "generated",
      role: "viewer",
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

  await SystemLock.create({ _id: "bootstrap_admin" });

  const sourceSpecs = [
    {
      name: "Web Form Leads",
      description: "Inbound enterprise contact and demo request forms",
      schemaType: "web_form",
      active: true,
    },
    {
      name: "CRM Deals",
      description: "Real-time sales pipeline stage updates from CRM",
      schemaType: "crm",
      active: true,
    },
    {
      name: "Partner Orders",
      description: "B2B partner fulfillment and license order webhooks",
      schemaType: "partner",
      active: true,
    },
  ];

  const sources = [];
  for (const spec of sourceSpecs) {
    const apiKey = generateSecret(24, "wpk_");
    const signingSecret = generateSecret(32, "whsec_");
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

  const rng = createRng(20261112);
  const now = Date.now();
  const HOUR_MS = 3_600_000;
  const DAY_MS = 24 * HOUR_MS;
  const statusCounts = {
    processed: 0,
    invalid: 0,
    failed: 0,
    dead_letter: 0,
    valid: 0,
  };

  const eventsToInsert = [];
  const recordsToInsert = [];
  let seq = 0;

  // Build a 14-day timeline (daysAgo 13 down to 0) with an explicit 2-day outage on Partner Orders (days 5 and 4 ago).
  for (let daysAgo = 13; daysAgo >= 0; daysAgo -= 1) {
    const isIncidentDay = daysAgo === 5 || daysAgo === 4;
    const isRecoveryDay = daysAgo === 3;
    const dailyTotal = isIncidentDay
      ? 24
      : daysAgo === 0
        ? 16
        : 16 + Math.floor(rng() * 5);

    for (let j = 0; j < dailyTotal; j += 1) {
      const i = seq++;
      const srcIdx = isIncidentDay && j % 2 === 0 ? 2 : i % sources.length;
      const src = sources[srcIdx];

      const minuteOffset =
        daysAgo === 0
          ? Math.floor(2 + (j / dailyTotal) * 180) // newest event ~2m ago, spread across last 3 hours
          : Math.floor(rng() * 23 * 60 + 20);
      const receivedAt =
        daysAgo === 0
          ? new Date(now - minuteOffset * 60_000)
          : new Date(
              now - daysAgo * DAY_MS - (minuteOffset % (20 * 60)) * 60_000,
            );

      const person = PEOPLE[Math.floor(rng() * PEOPLE.length)];
      const account = ACCOUNTS[Math.floor(rng() * ACCOUNTS.length)];
      const fullName = `${person.first} ${person.last}`;
      const email = `${person.first.toLowerCase()}.${person.last.toLowerCase()}@${account.domain}`;

      let status = "processed";
      const roll = rng();

      if (src.schemaType === "partner" && isIncidentDay) {
        // Outage incident: 55% dead_letter, 25% failed, 10% invalid, 10% recovered
        if (roll < 0.55) status = "dead_letter";
        else if (roll < 0.8) status = "failed";
        else if (roll < 0.9) status = "invalid";
        else status = "processed";
      } else if (src.schemaType === "partner" && isRecoveryDay) {
        // Partial tail recovery after hotfix
        if (roll < 0.14) status = "failed";
        else if (roll < 0.22) status = "invalid";
        else status = "processed";
      } else if (daysAgo <= 1 && j < 2) {
        // Keep fresh actionable events in the last 36h for the Overview Needs Attention panel
        status = j === 0 ? "failed" : "dead_letter";
      } else {
        if (roll < 0.08) status = "invalid";
        else if (roll < 0.11) status = "failed";
        else if (roll < 0.13) status = "dead_letter";
        else if (roll < 0.15) status = "valid";
        else status = "processed";
      }

      statusCounts[status] += 1;

      const eventId = new Source.base.Types.ObjectId();
      const recordId =
        status === "processed" ? new Source.base.Types.ObjectId() : null;

      let payload;
      let normalized;
      if (src.schemaType === "web_form") {
        const topic = WEB_TOPICS[Math.floor(rng() * WEB_TOPICS.length)];
        const estBudget =
          Math.round((account.baseAmount * (0.25 + rng() * 0.4)) / 25) * 25;
        payload = {
          submissionId: `wf-${2026}-${1040 + i}`,
          fullName,
          email: status === "invalid" ? "bad-email-format" : email,
          company: account.company,
          jobTitle: person.title,
          topic,
          tags: ["inbound", estBudget > 15000 ? "enterprise" : "mid-market"],
        };
        normalized = {
          _id: recordId,
          sourceId: src._id,
          eventId,
          externalId: payload.submissionId,
          clientName: fullName,
          clientEmail: email,
          company: account.company,
          category: topic,
          amount: 0,
          currency: "USD",
          metadata: { title: person.title, tags: payload.tags },
          normalizedAt: new Date(
            receivedAt.getTime() + 140 + Math.floor(rng() * 180),
          ),
        };
      } else if (src.schemaType === "crm") {
        const stage = CRM_STAGES[Math.floor(rng() * CRM_STAGES.length)];
        const dealValue =
          Math.round((account.baseAmount * (0.6 + rng() * 1.45)) / 50) * 50;
        payload = {
          contactId: `crm-opp-${4200 + i}`,
          name: fullName,
          email: status === "invalid" ? "missing-domain@" : email,
          accountName: account.company,
          stage,
          dealValue,
          currency: "USD",
          ownerRole: person.title,
        };
        normalized = {
          _id: recordId,
          sourceId: src._id,
          eventId,
          externalId: payload.contactId,
          clientName: fullName,
          clientEmail: email,
          company: account.company,
          category: stage,
          amount: dealValue,
          currency: "USD",
          metadata: { stage, ownerRole: person.title },
          normalizedAt: new Date(
            receivedAt.getTime() + 190 + Math.floor(rng() * 240),
          ),
        };
      } else {
        const skuSpec = PARTNER_SKUS[Math.floor(rng() * PARTNER_SKUS.length)];
        const qty = 2 + Math.floor(rng() * 12);
        const orderAmount = qty * skuSpec.unitPrice;
        payload = {
          partnerRef: `po-${8800 + i}`,
          customer: {
            name: fullName,
            email,
            organization: account.company,
          },
          items:
            status === "invalid"
              ? []
              : [
                  {
                    sku: skuSpec.sku,
                    quantity: qty,
                    unitPrice: skuSpec.unitPrice,
                  },
                ],
          currency: "USD",
          region: i % 3 === 0 ? "eu-west" : "us-east",
        };
        normalized = {
          _id: recordId,
          sourceId: src._id,
          eventId,
          externalId: payload.partnerRef,
          clientName: fullName,
          clientEmail: email,
          company: account.company,
          category: "partner_order",
          amount: orderAmount,
          currency: "USD",
          metadata: { sku: skuSpec.sku, quantity: qty, region: payload.region },
          normalizedAt: new Date(
            receivedAt.getTime() + 210 + Math.floor(rng() * 320),
          ),
        };
      }

      const logs = [
        {
          timestamp: receivedAt,
          stage: "ingest",
          level: "info",
          message: "HMAC-SHA256 signature verified within timestamp tolerance",
        },
      ];
      const errors = [];

      if (status === "invalid") {
        const field = src.schemaType === "partner" ? "items" : "email";
        const message =
          src.schemaType === "partner"
            ? "Partner order must include at least 1 line item"
            : "Invalid email address format";
        errors.push({ field, message, code: "VALIDATION_ERROR" });
        logs.push({
          timestamp: new Date(receivedAt.getTime() + 22),
          stage: "validate",
          level: "warn",
          message: `Payload failed ${src.schemaType} schema validation: ${message}`,
        });
      } else {
        logs.push({
          timestamp: new Date(receivedAt.getTime() + 18),
          stage: "validate",
          level: "info",
          message: `Payload validated against ${src.schemaType} schema`,
        });
      }

      let attempts = 0;
      let processedAt = null;
      let nextRetryAt = null;
      let deadLetteredAt = null;

      if (status === "processed") {
        const retriedOnce = isRecoveryDay && src.schemaType === "partner";
        attempts = retriedOnce ? 2 : 1;
        if (retriedOnce) {
          logs.push({
            timestamp: new Date(receivedAt.getTime() + 140),
            stage: "retry",
            level: "warn",
            message:
              "Attempt 1/4 failed (Partner API 503); retry scheduled in 1000ms",
          });
        }
        const latencyMs = retriedOnce ? 1320 : 120 + Math.floor(rng() * 280);
        processedAt = new Date(receivedAt.getTime() + latencyMs);
        logs.push({
          timestamp: processedAt,
          stage: "process",
          level: "info",
          message: `Processed successfully on attempt ${attempts} into Record ${recordId}`,
        });
        recordsToInsert.push(normalized);
      } else if (status === "failed") {
        attempts = 2;
        const errMsg =
          src.schemaType === "partner"
            ? "Partner fulfillment gateway 503 Service Unavailable"
            : "Downstream CRM write lock timeout (ETIMEDOUT)";
        errors.push({
          field: "downstream",
          message: errMsg,
          code: "DOWNSTREAM_TRANSIENT",
        });
        logs.push({
          timestamp: new Date(receivedAt.getTime() + 95),
          stage: "retry",
          level: "warn",
          message: `Attempt 1/4 failed (${errMsg}); retry scheduled in 1000ms`,
        });
        logs.push({
          timestamp: new Date(receivedAt.getTime() + 1140),
          stage: "retry",
          level: "warn",
          message: `Attempt 2/4 failed (${errMsg}); retry scheduled in 2000ms`,
        });
        nextRetryAt = new Date(now + 365 * DAY_MS); // far in future so worker does not exhaust during demo
      } else if (status === "dead_letter") {
        attempts = 4;
        const errMsg =
          src.schemaType === "partner"
            ? "Partner ERP rate limit / upstream 503 outage persisted across 4 attempts"
            : "Customer record sync rejected permanently (HTTP 502 Bad Gateway)";
        errors.push({
          field: "downstream",
          message: errMsg,
          code: "MAX_ATTEMPTS_EXCEEDED",
        });
        logs.push(
          {
            timestamp: new Date(receivedAt.getTime() + 90),
            stage: "retry",
            level: "warn",
            message: `Attempt 1/4 failed (${errMsg}); retry scheduled in 1000ms`,
          },
          {
            timestamp: new Date(receivedAt.getTime() + 1120),
            stage: "retry",
            level: "warn",
            message: `Attempt 2/4 failed (${errMsg}); retry scheduled in 2000ms`,
          },
          {
            timestamp: new Date(receivedAt.getTime() + 3180),
            stage: "retry",
            level: "warn",
            message: `Attempt 3/4 failed (${errMsg}); retry scheduled in 4000ms`,
          },
        );
        deadLetteredAt = new Date(receivedAt.getTime() + 7250);
        logs.push({
          timestamp: deadLetteredAt,
          stage: "dead_letter",
          level: "error",
          message: `Exhausted 4 attempts: ${errMsg}`,
        });
      } else if (status === "valid") {
        nextRetryAt = new Date(now + 365 * DAY_MS);
      }

      eventsToInsert.push({
        _id: eventId,
        sourceId: src._id,
        payload,
        status,
        errors,
        processingLogs: logs,
        idempotencyKey: `evt-${src.schemaType}-${String(1000 + i)}-${account.domain.split(".")[0]}`,
        attempts,
        maxAttempts: 4,
        nextRetryAt,
        deadLetteredAt,
        receivedAt,
        processedAt,
        recordId,
      });
    }
  }

  await Event.insertMany(eventsToInsert);
  await RecordModel.insertMany(recordsToInsert);

  await AuditLog.insertMany([
    {
      actorId: createdUsers.admin._id,
      actorEmail: createdUsers.admin.email,
      actorRole: "admin",
      action: "auth.bootstrap_admin",
      resourceType: "user",
      resourceId: String(createdUsers.admin._id),
      metadata: { role: "admin" },
      createdAt: new Date(now - 14 * DAY_MS),
    },
    ...sources.map((s, idx) => ({
      actorId: createdUsers.admin._id,
      actorEmail: createdUsers.admin.email,
      actorRole: "admin",
      action: "source.create",
      resourceType: "source",
      resourceId: String(s._id),
      metadata: { name: s.name, schemaType: s.schemaType },
      createdAt: new Date(now - (13 - idx) * DAY_MS),
    })),
    {
      actorId: createdUsers.admin._id,
      actorEmail: createdUsers.admin.email,
      actorRole: "admin",
      action: "source.rotate_secret",
      resourceType: "source",
      resourceId: String(sources[2]._id),
      metadata: { reason: "post_incident_partner_gateway_key_rotation" },
      createdAt: new Date(now - 3 * DAY_MS),
    },
    {
      actorId: createdUsers.manager._id,
      actorEmail: createdUsers.manager.email,
      actorRole: "manager",
      action: "event.replay",
      resourceType: "event",
      resourceId: String(eventsToInsert[0]._id),
      metadata: { previousStatus: "dead_letter" },
      createdAt: new Date(now - 2 * HOUR_MS),
    },
  ]);

  console.log("\nSeed completed successfully!");
  console.log(
    "Seeded Users (save these credentials; generated passwords are shown once):",
  );
  console.table(credentialsToPrint);
  console.log(
    "Seeded Sources:",
    sources.map((s) => `${s.name} (${s.schemaType})`).join(", "),
  );
  console.log("Seeded Events:", eventsToInsert.length, statusCounts);
  console.log("Seeded Records:", recordsToInsert.length);

  await disconnectDB();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
