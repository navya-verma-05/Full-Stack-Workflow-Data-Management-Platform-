import pino from "pino";
import { env } from "./env.js";

export const logger = pino({
  level: env.NODE_ENV === "test" ? "silent" : env.LOG_LEVEL,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'req.headers["x-webhook-signature"]',
      'req.headers["x-api-key"]',
      'req.headers["x-bootstrap-token"]',
      'res.headers["set-cookie"]',
      "*.password",
      "*.passwordHash",
      "*.signingSecret",
      "*.signingSecretHash",
      "*.signingSecretEncrypted",
      "*.apiKey",
      "*.apiKeyHash",
      "*.refreshToken",
      "*.accessToken",
      "*.bootstrapToken",
    ],
    censor: "[REDACTED]",
  },
  ...(env.NODE_ENV === "development"
    ? {
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
            ignore: "pid,hostname",
          },
        },
      }
    : {}),
});
