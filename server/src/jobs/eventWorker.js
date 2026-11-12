import crypto from 'node:crypto';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { Event } from '../models/Event.js';
import { RecordModel } from '../models/Record.js';
import { Source } from '../models/Source.js';
import {
  normalizePayloadToRecord,
  validateWebhookPayload,
} from '../services/normalizationService.js';

const LOCK_TTL_MS = 30_000;

let pollTimer = null;
let isPolling = false;

export async function defaultEventProcessor(event, source) {
  if (!source.active) {
    throw new Error('Source is disabled downstream');
  }

  if (env.NODE_ENV !== 'production') {
    const simulated = await Event.findOneAndUpdate(
      { _id: event._id, simulatedFailuresRemaining: { $gt: 0 } },
      { $inc: { simulatedFailuresRemaining: -1 } },
      { new: false }
    );
    if (simulated) {
      throw new Error('Simulated downstream transient failure (503)');
    }
  }

  const { valid, data, errors } = validateWebhookPayload(source.schemaType, event.payload);
  if (!valid) {
    const err = new Error('Event payload failed validation during processing');
    err.validationErrors = errors;
    throw err;
  }

  const normalized = normalizePayloadToRecord(
    source.schemaType,
    data,
    source._id,
    event._id
  );

  // Upsert keyed by unique eventId so retries remain strictly idempotent at the Record level.
  const record = await RecordModel.findOneAndUpdate(
    { eventId: event._id },
    { $setOnInsert: normalized },
    { upsert: true, new: true }
  );

  return record;
}

export async function claimNextEvent(workerId = `worker-${process.pid}`) {
  const now = new Date();
  const lockExpiry = new Date(now.getTime() + LOCK_TTL_MS);

  return Event.findOneAndUpdate(
    {
      status: { $in: ['valid', 'failed'] },
      nextRetryAt: { $lte: now, $ne: null },
      $or: [{ processingLockUntil: null }, { processingLockUntil: { $lte: now } }],
    },
    {
      $set: {
        processingLockUntil: lockExpiry,
        lockedBy: workerId,
      },
      $inc: { attempts: 1 },
    },
    {
      sort: { nextRetryAt: 1 },
      new: true,
    }
  );
}

export async function processClaimedEvent(
  event,
  { handler = defaultEventProcessor, baseDelayMs = env.RETRY_BASE_DELAY_MS } = {}
) {
  try {
    const source = await Source.findById(event.sourceId);
    if (!source) {
      throw new Error('Source not found for event');
    }

    const record = await handler(event, source);

    const updated = await Event.findByIdAndUpdate(
      event._id,
      {
        $set: {
          status: 'processed',
          processedAt: new Date(),
          recordId: record?._id || null,
          nextRetryAt: null,
          deadLetteredAt: null,
          processingLockUntil: null,
          lockedBy: null,
        },
        $push: {
          processingLogs: {
            timestamp: new Date(),
            stage: 'process',
            level: 'info',
            message: `Processed successfully on attempt ${event.attempts} into Record ${record?._id}`,
          },
        },
      },
      { new: true }
    );

    return updated;
  } catch (err) {
    const exhausted = event.attempts >= event.maxAttempts;
    const backoffMs = baseDelayMs * Math.pow(2, Math.max(0, event.attempts - 1));
    const nextRetryAt = exhausted ? null : new Date(Date.now() + backoffMs);
    const nextStatus = exhausted ? 'dead_letter' : 'failed';

    const logEntry = {
      timestamp: new Date(),
      stage: exhausted ? 'dead_letter' : 'retry',
      level: exhausted ? 'error' : 'warn',
      message: exhausted
        ? `Exhausted ${event.maxAttempts} attempts: ${err.message}`.slice(0, 500)
        : `Attempt ${event.attempts}/${event.maxAttempts} failed (${err.message}); retry scheduled in ${backoffMs}ms`.slice(
            0,
            500
          ),
    };

    const updated = await Event.findByIdAndUpdate(
      event._id,
      {
        $set: {
          status: nextStatus,
          nextRetryAt,
          deadLetteredAt: exhausted ? new Date() : null,
          processingLockUntil: null,
          lockedBy: null,
        },
        $push: {
          processingLogs: logEntry,
          ...(err.validationErrors ? { errors: { $each: err.validationErrors } } : {}),
        },
      },
      { new: true }
    );

    return updated;
  }
}

export async function processPendingEvents({
  maxBatch = 25,
  workerId = `worker-${crypto.randomUUID().slice(0, 8)}`,
  handler = defaultEventProcessor,
  baseDelayMs = env.RETRY_BASE_DELAY_MS,
} = {}) {
  const processed = [];

  for (let i = 0; i < maxBatch; i += 1) {
    const claimed = await claimNextEvent(workerId);
    if (!claimed) break;

    const result = await processClaimedEvent(claimed, { handler, baseDelayMs });
    processed.push(result);
  }

  return processed;
}

export function kickWorker() {
  if (env.NODE_ENV === 'test') {
    return;
  }
  setImmediate(async () => {
    try {
      await processPendingEvents();
    } catch (err) {
      logger.error({ err }, 'Async worker kick failed');
    }
  });
}

export function startWorker(intervalMs = env.RETRY_POLL_INTERVAL_MS) {
  if (pollTimer) return;

  pollTimer = setInterval(async () => {
    if (isPolling) return;
    isPolling = true;
    try {
      await processPendingEvents();
    } catch (err) {
      logger.error({ err }, 'Retry worker poll cycle failed');
    } finally {
      isPolling = false;
    }
  }, intervalMs);

  pollTimer.unref?.();
  logger.info({ intervalMs }, 'Mongo-backed event retry worker started');
}

export function stopWorker() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    logger.info('Mongo-backed event retry worker stopped');
  }
}

