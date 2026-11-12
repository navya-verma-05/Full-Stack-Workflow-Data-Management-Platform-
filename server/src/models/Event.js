import mongoose from 'mongoose';

export const EVENT_STATUSES = [
  'received',
  'valid',
  'invalid',
  'processed',
  'failed',
  'dead_letter',
];

const eventErrorSchema = new mongoose.Schema(
  {
    field: { type: String, maxlength: 120, default: '' },
    message: { type: String, required: true, maxlength: 500 },
    code: { type: String, maxlength: 64, default: 'VALIDATION_ERROR' },
  },
  { _id: false }
);

const processingLogSchema = new mongoose.Schema(
  {
    timestamp: { type: Date, default: Date.now, required: true },
    stage: { type: String, required: true, maxlength: 64 },
    level: { type: String, enum: ['info', 'warn', 'error'], default: 'info' },
    message: { type: String, required: true, maxlength: 500 },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Source',
      required: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },
    status: {
      type: String,
      enum: EVENT_STATUSES,
      default: 'received',
      required: true,
    },
    errors: {
      type: [eventErrorSchema],
      default: [],
    },
    processingLogs: {
      type: [processingLogSchema],
      default: [],
    },
    idempotencyKey: {
      type: String,
      required: true,
      trim: true,
      maxlength: 256,
    },
    attempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    maxAttempts: {
      type: Number,
      default: 4,
      min: 1,
    },
    nextRetryAt: {
      type: Date,
      default: null,
    },
    deadLetteredAt: {
      type: Date,
      default: null,
    },
    processingLockUntil: {
      type: Date,
      default: null,
    },
    lockedBy: {
      type: String,
      maxlength: 128,
      default: null,
    },
    receivedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    processedAt: {
      type: Date,
      default: null,
    },
    recordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Record',
      default: null,
    },
  },
  {
    timestamps: true,
    suppressReservedKeysWarning: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Unique compound index on (sourceId, idempotencyKey): enforces idempotent webhook ingestion
// per source at the database layer so duplicate deliveries cannot create duplicate events.
eventSchema.index({ sourceId: 1, idempotencyKey: 1 }, { unique: true });

// Compound index on (status, receivedAt): optimizes filtered event lists and status summary aggregations.
eventSchema.index({ status: 1, receivedAt: -1 });

// Compound index on (sourceId, receivedAt): optimizes per-source event queries and time-series charts.
eventSchema.index({ sourceId: 1, receivedAt: -1 });

// Compound index on (status, nextRetryAt, processingLockUntil): enables atomic findOneAndUpdate
// job claims by the Mongo-backed retry worker without duplicate concurrent execution.
eventSchema.index({ status: 1, nextRetryAt: 1, processingLockUntil: 1 });

// Single-field descending index on receivedAt: speeds up global chronological pagination and date ranges.
eventSchema.index({ receivedAt: -1 });

export const Event = mongoose.model('Event', eventSchema);

