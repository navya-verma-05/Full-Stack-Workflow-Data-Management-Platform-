import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    actorEmail: {
      type: String,
      trim: true,
      maxlength: 254,
      default: 'system',
    },
    actorRole: {
      type: String,
      trim: true,
      maxlength: 32,
      default: 'system',
    },
    action: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    resourceType: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
    },
    resourceId: {
      type: String,
      trim: true,
      maxlength: 128,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      trim: true,
      maxlength: 64,
      default: '',
    },
    userAgent: {
      type: String,
      trim: true,
      maxlength: 256,
      default: '',
    },
    createdAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  {
    versionKey: false,
  }
);

// Index on createdAt: supports reverse-chronological audit log pagination.
auditLogSchema.index({ createdAt: -1 });

// Compound index on (actorId, createdAt): filters audit history for a specific user.
auditLogSchema.index({ actorId: 1, createdAt: -1 });

// Compound index on (resourceType, resourceId, createdAt): traces all actions taken on a resource.
auditLogSchema.index({ resourceType: 1, resourceId: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);

