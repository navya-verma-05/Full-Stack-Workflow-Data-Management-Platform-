import { z } from 'zod';

export const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, 'Invalid MongoDB ObjectId')
  .max(24);

export const boundedString = (minLen, maxLen) =>
  z.string().trim().min(minLen).max(maxLen);

export const optionalBoundedString = (maxLen) =>
  z.string().trim().max(maxLen).optional();

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email address')
  .max(254);

export const paginationQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(10000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

