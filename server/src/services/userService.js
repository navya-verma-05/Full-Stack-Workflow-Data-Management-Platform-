import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";
import { recordAuditLog } from "./auditService.js";

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listUsers({
  page = 1,
  limit = 20,
  role,
  active,
  search,
}) {
  const filter = {};
  if (role) filter.role = role;
  if (typeof active === "boolean") filter.active = active;
  if (search) {
    const regex = new RegExp(escapeRegex(search), "i");
    filter.$or = [{ name: regex }, { email: regex }];
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    User.countDocuments(filter),
  ]);

  return {
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    },
  };
}

export async function getUserById(id) {
  const user = await User.findById(id);
  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }
  return user;
}

export async function updateUser(id, updates, { actor, req = null }) {
  const user = await User.findById(id);
  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  const isSelf = actor && String(actor._id) === String(user._id);
  if (isSelf) {
    if (updates.active === false) {
      throw new AppError(
        "Admins cannot deactivate their own account",
        400,
        "SELF_MODIFICATION_FORBIDDEN",
      );
    }
    if (updates.role && updates.role !== user.role) {
      throw new AppError(
        "Admins cannot change their own role",
        400,
        "SELF_MODIFICATION_FORBIDDEN",
      );
    }
  }

  const previous = { name: user.name, role: user.role, active: user.active };

  if (updates.name !== undefined) user.name = updates.name;
  if (updates.role !== undefined) user.role = updates.role;
  if (updates.active !== undefined) user.active = updates.active;

  await user.save();

  await recordAuditLog({
    actor,
    action: "user.update",
    resourceType: "user",
    resourceId: user._id,
    metadata: { previous, updated: updates },
    req,
  });

  return user;
}
