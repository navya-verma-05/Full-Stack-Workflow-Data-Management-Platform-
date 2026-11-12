import { z } from 'zod';
import { SOURCE_SCHEMA_TYPES } from '../models/Source.js';
import { boundedString, objectIdSchema, paginationQuerySchema } from './common.js';

export const sourceIdParamSchema = {
  params: z
    .object({
      id: objectIdSchema,
    })
    .strict(),
};

export const listSourcesSchema = {
  query: paginationQuerySchema
    .extend({
      active: z
        .enum(['true', 'false'])
        .transform((v) => v === 'true')
        .optional(),
      schemaType: z.enum(SOURCE_SCHEMA_TYPES).optional(),
    })
    .strict(),
};

export const createSourceSchema = {
  body: z
    .object({
      name: boundedString(2, 120),
      description: z.string().trim().max(500).default(''),
      schemaType: z.enum(SOURCE_SCHEMA_TYPES).default('generic'),
      active: z.boolean().default(true),
    })
    .strict(),
};

export const updateSourceSchema = {
  params: z
    .object({
      id: objectIdSchema,
    })
    .strict(),
  body: z
    .object({
      name: boundedString(2, 120).optional(),
      description: z.string().trim().max(500).optional(),
      schemaType: z.enum(SOURCE_SCHEMA_TYPES).optional(),
      active: z.boolean().optional(),
    })
    .strict()
    .refine((data) => Object.keys(data).length > 0, {
      message: 'At least one field must be provided',
    }),
};

export const replayEventSchema = {
  params: z
    .object({
      id: objectIdSchema,
    })
    .strict(),
};

