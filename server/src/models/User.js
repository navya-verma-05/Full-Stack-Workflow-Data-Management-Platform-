import mongoose from "mongoose";

export const USER_ROLES = ["admin", "manager", "viewer"];

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: USER_ROLES,
      default: "viewer",
      required: true,
    },
    active: {
      type: Boolean,
      default: true,
      required: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        delete ret.passwordHash;
        delete ret.__v;
        return ret;
      },
    },
  },
);

// Unique index on email: guarantees one account per email and makes login lookups O(log N).
userSchema.index({ email: 1 }, { unique: true });

// Compound index on role + active: speeds up admin user-management filtering by role and status.
userSchema.index({ role: 1, active: 1 });

export const User = mongoose.model("User", userSchema);
