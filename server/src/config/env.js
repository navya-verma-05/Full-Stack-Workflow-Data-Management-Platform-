import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load server/.env if present (skipped/overridden cleanly when env vars are already set, e.g. in tests or CI)
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const nonPlaceholderSecret = (name) =>
  z
    .string({ required_error: `${name} is required` })
    .min(32, `${name} must be at least 32 characters`)
    .max(512, `${name} must be at most 512 characters`)
    .refine((val) => !val.includes('CHANGE_ME'), {
      message: `${name} must not use a CHANGE_ME placeholder`,
    });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  MONGODB_URI: z
    .string()
    .trim()
    .min(1, 'MONGODB_URI is required')
    .max(1024)
    .refine((val) => !val.includes('CHANGE_ME'), {
      message: 'MONGODB_URI must not contain CHANGE_ME',
    }),
  CLIENT_ORIGIN: z.string().trim().min(1).max(512).default('http://localhost:5173'),

  JWT_ACCESS_SECRET: nonPlaceholderSecret('JWT_ACCESS_SECRET'),
  JWT_REFRESH_SECRET: nonPlaceholderSecret('JWT_REFRESH_SECRET'),
  JWT_ACCESS_EXPIRES_IN: z.string().trim().min(2).max(16).default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().trim().min(2).max(16).default('7d'),
  SIGNING_SECRET_ENCRYPTION_KEY: nonPlaceholderSecret('SIGNING_SECRET_ENCRYPTION_KEY'),

  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),

  REQUEST_BODY_LIMIT: z
    .string()
    .trim()
    .regex(/^\d+(kb|mb|b)$/i, 'REQUEST_BODY_LIMIT must look like 100kb, 1mb, or 1024b')
    .max(16)
    .default('100kb'),

  WEBHOOK_TOLERANCE_SECONDS: z.coerce.number().int().min(10).max(3600).default(300),
  RETRY_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(4),
  RETRY_POLL_INTERVAL_MS: z.coerce.number().int().min(100).max(60000).default(2000),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).max(3600000).default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().min(10).max(100000).default(300),
  WEBHOOK_RATE_LIMIT_MAX: z.coerce.number().int().min(10).max(100000).default(1000),

  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

export function parseEnv(rawEnv = process.env) {
  const parsed = envSchema.safeParse(rawEnv);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.') || 'env'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return Object.freeze(parsed.data);
}

export const env = parseEnv(process.env);

