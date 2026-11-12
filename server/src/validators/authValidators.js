import { z } from 'zod';
import { USER_ROLES } from '../models/User.js';
import { boundedString, emailSchema } from './common.js';

export const registerSchema = {
  body: z
    .object({
      name: boundedString(2, 120),
      email: emailSchema,
      password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .max(128, 'Password must be at most 128 characters'),
      role: z.enum(USER_ROLES).default('viewer'),
    })
    .strict(),
};

export const loginSchema = {
  body: z
    .object({
      email: emailSchema,
      password: z
        .string()
        .min(1, 'Password is required')
        .max(128, 'Password must be at most 128 characters'),
    })
    .strict(),
};

