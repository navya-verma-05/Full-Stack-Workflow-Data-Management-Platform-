import { AuditLog } from "../models/AuditLog.js";
import { logger } from "../config/logger.js";

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordHash",
  "signingSecret",
  "signingSecretHash",
  "signingSecretEncrypted",
  "apiKey",
  "apiKeyHash",
  "refreshToken",
  "accessToken",
]);

function sanitizeMetadata(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 4) return "[TRUNCATED]";
  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => sanitizeMetadata(item, depth + 1));
  }
  if (typeof value === "object") {
    const clean = {};
    for (const [k, v] of Object.entries(value)) {
      if (SENSITIVE_KEYS.has(k)) {
        clean[k] = "[REDACTED]";
      } else {
        clean[k] = sanitizeMetadata(v, depth + 1);
      }
    }
    return clean;
  }
  return value;
}

export async function recordAuditLog({
  actor = null,
  action,
  resourceType,
  resourceId = "",
  metadata = {},
  req = null,
}) {
  try {
    return await AuditLog.create({
      actorId: actor?._id || null,
      actorEmail: actor?.email || "system",
      actorRole: actor?.role || "system",
      action,
      resourceType,
      resourceId: resourceId ? String(resourceId) : "",
      metadata: sanitizeMetadata(metadata),
      ipAddress: req?.ip || "",
      userAgent:
        typeof req?.headers?.["user-agent"] === "string"
          ? req.headers["user-agent"].slice(0, 256)
          : "",
    });
  } catch (err) {
    logger.warn({ err, action, resourceType }, "Failed to persist audit log");
    return null;
  }
}
