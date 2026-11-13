import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { AppError } from "../utils/AppError.js";

export async function authenticate(req, _res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return next(new AppError("Authentication required", 401, "UNAUTHORIZED"));
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      return next(new AppError("Authentication required", 401, "UNAUTHORIZED"));
    }

    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET);
    if (payload.type !== "access" || !payload.sub) {
      return next(new AppError("Invalid access token", 401, "INVALID_TOKEN"));
    }

    const user = await User.findById(payload.sub);
    if (!user || !user.active) {
      return next(
        new AppError("Account not found or inactive", 401, "UNAUTHORIZED"),
      );
    }

    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

export function authorize(...allowedRoles) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError("Authentication required", 401, "UNAUTHORIZED"));
    }
    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new AppError(
          `Forbidden: requires one of [${allowedRoles.join(", ")}]`,
          403,
          "FORBIDDEN",
        ),
      );
    }
    return next();
  };
}
