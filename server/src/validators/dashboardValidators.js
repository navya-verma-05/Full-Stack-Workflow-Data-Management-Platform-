import { z } from 'zod';
import { EVENT_STATUSES } from '../models/Event.js';
import { boundedString, objectIdSchema, paginationQuerySchema } from './common.js';

const dateStringSchema = z
  .string()
  .trim()
  .max(40)
  .refine((val) => !Number.isNaN(Date.parse(val)), {
    message: 'Invalid ISO date string',
  });

const searchSchema = boundedString(1, 100);

export const metricsSummarySchema = {
  query: z
    .object({
      from: dateStringSchema.optional(),
      to: dateStringSchema.optional(),
      sourceId: objectIdSchema.optional(),
    })
    .strict(),
};

export const metricsTimeSeriesSchema = {
  query: z
    .object({
      from: dateStringSchema.optional(),
      to: dateStringSchema.optional(),
      sourceId: objectIdSchema.optional(),
      granularity: z.enum(['day', 'hour']).default('day'),
    })
    .strict(),
};

export const listEventsSchema = {
  query: paginationQuerySchema
    .extend({
      status: z.enum(EVENT_STATUSES).optional(),
      sourceId: objectIdSchema.optional(),
      from: dateStringSchema.optional(),
      to: dateStringSchema.optional(),
      search: searchSchema.optional(),
    })
    .strict(),
};

export const eventIdParamSchema = {
  params: z
    .object({
      id: objectIdSchema,
    })
    .strict(),
};

export const listRecordsSchema = {
  query: paginationQuerySchema
    .extend({
      sourceId: objectIdSchema.optional(),
      category: boundedString(1, 80).optional(),
      from: dateStringSchema.optional(),
      to: dateStringSchema.optional(),
      search: searchSchema.optional(),
    })
    .strict(),
};

export const listAuditLogsSchema = {
  query: paginationQuerySchema
    .extend({
      action: boundedString(1, 100).optional(),
      resourceType: boundedString(1, 64).optional(),
      actorId: objectIdSchema.optional(),
      from: dateStringSchema.optional(),
      to: dateStringSchema.optional(),
      search: searchSchema.optional(),
    })
    .strict(),
};
