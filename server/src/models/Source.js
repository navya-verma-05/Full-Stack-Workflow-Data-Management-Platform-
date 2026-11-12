import mongoose from 'mongoose';

export const SOURCE_SCHEMA_TYPES = ['web_form', 'crm', 'partner', 'generic'];

const sourceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    schemaType: {
      type: String,
      enum: SOURCE_SCHEMA_TYPES,
      default: 'generic',
      required: true,
    },
    apiKeyHash: {
      type: String,
      required: true,
      select: false,
    },
    apiKeyPrefix: {
      type: String,
      required: true,
      maxlength: 16,
    },
    signingSecretHash: {
      type: String,
      required: true,
      select: false,
    },
    // AES-256-GCM encrypted signing secret so the server can verify HMAC-SHA256 signatures
    // without storing the plaintext secret in MongoDB.
    signingSecretEncrypted: {
      type: String,
      required: true,
      select: false,
    },
    active: {
      type: Boolean,
      default: true,
      required: true,
    },
    secretRotatedAt: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.apiKeyHash;
        delete ret.signingSecretHash;
        delete ret.signingSecretEncrypted;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Unique index on name: prevents duplicate source registrations and optimizes name lookups.
sourceSchema.index({ name: 1 }, { unique: true });

// Index on active: speeds up queries filtering enabled webhook sources.
sourceSchema.index({ active: 1 });

export const Source = mongoose.model('Source', sourceSchema);

