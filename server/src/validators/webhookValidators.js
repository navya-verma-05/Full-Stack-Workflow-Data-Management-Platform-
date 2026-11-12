import { z } from 'zod';
import { boundedString, emailSchema, objectIdSchema } from './common.js';

export const webhookMetadataSchema = z
  .record(
    z.string().trim().min(1).max(64),
    z.union([z.string().max(500), z.number().finite(), z.boolean()])
  )
  .refine((obj) => Object.keys(obj).length <= 25, {
    message: 'Metadata cannot exceed 25 keys',
  });

export const baseWebhookHeadersSchema = z.object({
  'x-webhook-signature': z.string().trim().min(1).max(256),
  'x-webhook-timestamp': z
    .string()
    .trim()
    .regex(/^\d{1,15}$/, 'x-webhook-timestamp must be a Unix epoch timestamp in seconds')
    .max(32),
  'x-idempotency-key': z.string().trim().min(1).max(256),
});

export const webhookParamsSchema = {
  params: z
    .object({
      sourceId: objectIdSchema,
    })
    .strict(),
};

export const genericWebhookPayloadSchema = z
  .object({
    externalId: boundedString(1, 128).optional(),
    clientName: boundedString(1, 160),
    clientEmail: emailSchema.optional(),
    company: boundedString(1, 160).optional(),
    phone: boundedString(3, 40).optional(),
    category: boundedString(1, 80).optional(),
    amount: z.number().finite().min(0).max(1e9).optional(),
    currency: boundedString(3, 8).optional(),
    tags: z.array(boundedString(1, 48)).max(20).optional(),
    metadata: webhookMetadataSchema.optional(),
  })
  .strict();

export const webFormWebhookPayloadSchema = z
  .object({
    submissionId: boundedString(1, 128),
    fullName: boundedString(1, 160),
    email: emailSchema,
    company: boundedString(1, 160).optional(),
    phone: boundedString(3, 40).optional(),
    topic: boundedString(1, 80).optional(),
    notes: boundedString(1, 2000).optional(),
    tags: z.array(boundedString(1, 48)).max(20).optional(),
  })
  .strict();

export const crmWebhookPayloadSchema = z
  .object({
    contactId: boundedString(1, 128),
    name: boundedString(1, 160),
    email: emailSchema,
    accountName: boundedString(1, 160).optional(),
    stage: boundedString(1, 64),
    dealValue: z.number().finite().min(0).max(1e9),
    currency: boundedString(3, 8).default('USD'),
    tags: z.array(boundedString(1, 48)).max(20).optional(),
  })
  .strict();

export const partnerWebhookPayloadSchema = z
  .object({
    partnerRef: boundedString(1, 128),
    customer: z
      .object({
        name: boundedString(1, 160),
        email: emailSchema,
        organization: boundedString(1, 160).optional(),
      })
      .strict(),
    items: z
      .array(
        z
          .object({
            sku: boundedString(1, 64),
            quantity: z.number().int().min(1).max(100000),
            unitPrice: z.number().finite().min(0).max(1e7),
          })
          .strict()
      )
      .min(1)
      .max(100),
    currency: boundedString(3, 8).default('USD'),
  })
  .strict();

export const PAYLOAD_SCHEMAS_BY_TYPE = {
  generic: genericWebhookPayloadSchema,
  web_form: webFormWebhookPayloadSchema,
  crm: crmWebhookPayloadSchema,
  partner: partnerWebhookPayloadSchema,
};
