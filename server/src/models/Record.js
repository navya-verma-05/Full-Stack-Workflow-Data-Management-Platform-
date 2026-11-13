import mongoose from "mongoose";

const recordSchema = new mongoose.Schema(
  {
    sourceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Source",
      required: true,
    },
    eventId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Event",
      required: true,
    },
    externalId: {
      type: String,
      trim: true,
      maxlength: 128,
      default: "",
    },
    clientName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    clientEmail: {
      type: String,
      trim: true,
      lowercase: true,
      maxlength: 254,
      default: "",
    },
    company: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 40,
      default: "",
    },
    category: {
      type: String,
      trim: true,
      maxlength: 80,
      default: "general",
    },
    amount: {
      type: Number,
      default: 0,
    },
    currency: {
      type: String,
      trim: true,
      uppercase: true,
      maxlength: 8,
      default: "USD",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    normalizedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Unique index on eventId: guarantees a 1-to-1 relationship between a valid Event and its Record.
recordSchema.index({ eventId: 1 }, { unique: true });

// Compound index on (sourceId, createdAt): supports paginated per-source record queries.
recordSchema.index({ sourceId: 1, createdAt: -1 });

// Index on clientEmail: speeds up record lookups and deduplication checks by client email.
recordSchema.index({ clientEmail: 1 });

// Text index across client fields: powers fast server-side text search on normalized records.
recordSchema.index({
  clientName: "text",
  clientEmail: "text",
  company: "text",
  externalId: "text",
});

export const RecordModel = mongoose.model("Record", recordSchema);
