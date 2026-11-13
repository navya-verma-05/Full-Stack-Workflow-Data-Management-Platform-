import mongoose from "mongoose";

const refreshTokenSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    revokedAt: {
      type: Date,
      default: null,
    },
    replacedByHash: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Unique index on tokenHash: allows O(log N) lookup and prevents duplicate token hashes.
refreshTokenSchema.index({ tokenHash: 1 }, { unique: true });

// Compound index on (userId, revokedAt): speeds up revoking all active sessions for a user.
refreshTokenSchema.index({ userId: 1, revokedAt: 1 });

// TTL index on expiresAt: automatically removes expired refresh token records from MongoDB.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model("RefreshToken", refreshTokenSchema);
