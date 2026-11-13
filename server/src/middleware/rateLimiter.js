import rateLimit from "express-rate-limit";
import { env } from "../config/env.js";

const skipInTest = () => env.NODE_ENV === "test";

export const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: skipInTest,
  message: {
    error: {
      code: "RATE_LIMITED",
      message: "Too many requests, please try again later",
    },
  },
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: skipInTest,
  message: {
    error: {
      code: "AUTH_RATE_LIMITED",
      message: "Too many authentication attempts, please try again later",
    },
  },
});

export const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: env.WEBHOOK_RATE_LIMIT_MAX,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: skipInTest,
  message: {
    error: {
      code: "WEBHOOK_RATE_LIMITED",
      message: "Webhook rate limit exceeded",
    },
  },
});
