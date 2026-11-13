import mongoose from "mongoose";

const systemLockSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },
    acquiredAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
  },
  { versionKey: false },
);

export const SystemLock = mongoose.model("SystemLock", systemLockSchema);
