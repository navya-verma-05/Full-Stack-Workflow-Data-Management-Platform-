import crypto from "node:crypto";
import { env } from "../config/env.js";

function getEncryptionKey() {
  return crypto
    .createHash("sha256")
    .update(env.SIGNING_SECRET_ENCRYPTION_KEY)
    .digest();
}

export function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

export function generateSecret(byteLength = 32, prefix = "") {
  const token = crypto.randomBytes(byteLength).toString("hex");
  return prefix ? `${prefix}${token}` : token;
}

export function encryptSecret(plaintext) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(serialized) {
  const parts = serialized.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted secret format");
  }
  const [ivHex, authTagHex, dataHex] = parts;
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getEncryptionKey(),
    Buffer.from(ivHex, "hex"),
  );
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

export function constantTimeEqualHex(hexA, hexB) {
  if (typeof hexA !== "string" || typeof hexB !== "string") {
    return false;
  }
  if (
    hexA.length !== hexB.length ||
    hexA.length === 0 ||
    hexA.length % 2 !== 0
  ) {
    return false;
  }
  if (!/^[0-9a-f]+$/i.test(hexA) || !/^[0-9a-f]+$/i.test(hexB)) {
    return false;
  }
  const bufA = Buffer.from(hexA, "hex");
  const bufB = Buffer.from(hexB, "hex");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function constantTimeEqualUtf8(a, b) {
  if (
    typeof a !== "string" ||
    typeof b !== "string" ||
    a.length === 0 ||
    b.length === 0
  ) {
    return false;
  }
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

export function computeWebhookHmacHex(signingSecret, timestamp, rawBodyBuffer) {
  const prefix = Buffer.from(`${timestamp}.`, "utf8");
  const payload = Buffer.isBuffer(rawBodyBuffer)
    ? rawBodyBuffer
    : Buffer.from(String(rawBodyBuffer || ""), "utf8");
  return crypto
    .createHmac("sha256", signingSecret)
    .update(Buffer.concat([prefix, payload]))
    .digest("hex");
}
