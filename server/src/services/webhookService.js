import { env } from '../config/env.js';
import { Event } from '../models/Event.js';
import { Source } from '../models/Source.js';
import { AppError } from '../utils/AppError.js';
import {
  computeWebhookHmacHex,
  constantTimeEqualHex,
  decryptSecret,
} from '../utils/crypto.js';
import { baseWebhookHeadersSchema } from '../validators/webhookValidators.js';
import { validateWebhookPayload } from './normalizationService.js';
import { recordAuditLog } from './auditService.js';
import { kickWorker } from '../jobs/eventWorker.js';

function extractHexSignature(headerValue) {
  const trimmed = headerValue.trim();
  const hex = trimmed.startsWith('sha256=') ? trimmed.slice(7) : trimmed;
  return hex.toLowerCase();
}

export function verifyWebhookSignatureAndTimestamp({ source, headers, rawBody }) {
  const normalizedHeaders = {
    'x-webhook-signature': headers['x-webhook-signature'],
    'x-webhook-timestamp': headers['x-webhook-timestamp'],
    'x-idempotency-key': headers['x-idempotency-key'],
  };

  const parsedHeaders = baseWebhookHeadersSchema.safeParse(normalizedHeaders);
  if (!parsedHeaders.success) {
    const missingSig = !headers['x-webhook-signature'];
    const missingTs = !headers['x-webhook-timestamp'];
    throw new AppError(
      missingSig || missingTs
        ? 'Missing required webhook authentication headers'
        : 'Invalid webhook authentication headers',
      missingSig || missingTs ? 401 : 400,
      missingSig || missingTs ? 'MISSING_WEBHOOK_AUTH' : 'INVALID_WEBHOOK_HEADERS',
      parsedHeaders.error.issues.map((i) => ({
        field: i.path.join('.'),
        message: i.message,
      }))
    );
  }

  const timestampStr = parsedHeaders.data['x-webhook-timestamp'];
  const timestampSec = Number(timestampStr);
  const nowSec = Math.floor(Date.now() / 1000);

  if (Math.abs(nowSec - timestampSec) > env.WEBHOOK_TOLERANCE_SECONDS) {
    throw new AppError(
      'Webhook timestamp outside tolerance window',
      401,
      'WEBHOOK_TIMESTAMP_OUT_OF_RANGE'
    );
  }

  const signingSecret = decryptSecret(source.signingSecretEncrypted);
  const expectedHex = computeWebhookHmacHex(signingSecret, timestampStr, rawBody);
  const providedHex = extractHexSignature(parsedHeaders.data['x-webhook-signature']);

  if (!constantTimeEqualHex(providedHex, expectedHex)) {
    throw new AppError('Invalid webhook signature', 401, 'INVALID_WEBHOOK_SIGNATURE');
  }

  return {
    idempotencyKey: parsedHeaders.data['x-idempotency-key'],
  };
}

export async function ingestWebhook({ sourceId, headers, rawBody, body }) {
  const source = await Source.findById(sourceId).select('+signingSecretEncrypted');
  if (!source) {
    throw new AppError('Source not found', 404, 'SOURCE_NOT_FOUND');
  }
  if (!source.active) {
    throw new AppError('Source is disabled', 403, 'SOURCE_INACTIVE');
  }

  const { idempotencyKey } = verifyWebhookSignatureAndTimestamp({
    source,
    headers,
    rawBody,
  });

  let event;
  try {
    event = await Event.create({
      sourceId: source._id,
      payload: body,
      status: 'received',
      idempotencyKey,
      maxAttempts: env.RETRY_MAX_ATTEMPTS,
      receivedAt: new Date(),
      processingLogs: [
        {
          timestamp: new Date(),
          stage: 'ingest',
          level: 'info',
          message: 'Webhook HMAC signature verified and event accepted',
        },
      ],
    });
  } catch (err) {
    if (err?.code === 11000) {
      const existing = await Event.findOne({ sourceId: source._id, idempotencyKey });
      return {
        duplicate: true,
        invalid: false,
        event: existing,
      };
    }
    throw err;
  }

  const validation = validateWebhookPayload(source.schemaType, body);

  if (!validation.valid) {
    const invalidEvent = await Event.findByIdAndUpdate(
      event._id,
      {
        $set: {
          status: 'invalid',
          errors: validation.errors,
        },
        $push: {
          processingLogs: {
            timestamp: new Date(),
            stage: 'validate',
            level: 'warn',
            message: `Payload failed ${source.schemaType} schema validation (${validation.errors.length} error(s))`,
          },
        },
      },
      { new: true }
    );

    return {
      duplicate: false,
      invalid: true,
      event: invalidEvent,
    };
  }

  const validEvent = await Event.findByIdAndUpdate(
    event._id,
    {
      $set: {
        status: 'valid',
        payload: validation.data,
        nextRetryAt: new Date(),
      },
      $push: {
        processingLogs: {
          timestamp: new Date(),
          stage: 'validate',
          level: 'info',
          message: `Payload validated against ${source.schemaType} schema and queued for processing`,
        },
      },
    },
    { new: true }
  );

  kickWorker();

  return {
    duplicate: false,
    invalid: false,
    event: validEvent,
  };
}

export async function replayEvent(eventId, { actor, req = null }) {
  const event = await Event.findById(eventId);
  if (!event) {
    throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
  }

  if (!['failed', 'dead_letter'].includes(event.status)) {
    throw new AppError(
      `Only failed or dead-lettered events can be replayed (current status: ${event.status})`,
      409,
      'EVENT_NOT_REPLAYABLE'
    );
  }

  const updated = await Event.findByIdAndUpdate(
    event._id,
    {
      $set: {
        status: 'valid',
        attempts: 0,
        deadLetteredAt: null,
        nextRetryAt: new Date(),
        processingLockUntil: null,
        lockedBy: null,
      },
      $push: {
        processingLogs: {
          timestamp: new Date(),
          stage: 'replay',
          level: 'info',
          message: `Manual replay queued by ${actor.email}`,
        },
      },
    },
    { new: true }
  );

  await recordAuditLog({
    actor,
    action: 'event.replay',
    resourceType: 'event',
    resourceId: event._id,
    metadata: { sourceId: String(event.sourceId), previousStatus: event.status },
    req,
  });

  kickWorker();

  return updated;
}

