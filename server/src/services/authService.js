import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { recordAuditLog } from './auditService.js';

const BCRYPT_ROUNDS = env.NODE_ENV === 'test' ? 6 : 12;

export function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      role: user.role,
      email: user.email,
      type: 'access',
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: env.JWT_ACCESS_EXPIRES_IN }
  );
}

export function signRefreshToken(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      type: 'refresh',
    },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );
}

export async function registerUser({ name, email, password, role }, { actor = null, isBootstrap = false, req = null } = {}) {
  if (isBootstrap) {
    const count = await User.countDocuments();
    if (count > 0) {
      throw new AppError('Bootstrap registration is closed; admin authentication required', 403, 'FORBIDDEN');
    }
  }

  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError('Email is already registered', 409, 'EMAIL_EXISTS');
  }

  const assignedRole = isBootstrap ? 'admin' : role;
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await User.create({
    name,
    email,
    passwordHash,
    role: assignedRole,
    active: true,
  });

  await recordAuditLog({
    actor: actor || user,
    action: isBootstrap ? 'auth.bootstrap_admin' : 'user.create',
    resourceType: 'user',
    resourceId: user._id,
    metadata: { email: user.email, role: user.role },
    req,
  });

  return user;
}

export async function loginUser({ email, password }, { req = null } = {}) {
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  if (!user.active) {
    throw new AppError('Account is disabled', 403, 'ACCOUNT_DISABLED');
  }

  const passwordValid = await bcrypt.compare(password, user.passwordHash);
  if (!passwordValid) {
    throw new AppError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
  }

  user.lastLoginAt = new Date();
  await user.save();

  const accessToken = signAccessToken(user);
  const refreshToken = signRefreshToken(user);

  await recordAuditLog({
    actor: user,
    action: 'auth.login',
    resourceType: 'auth',
    resourceId: user._id,
    metadata: { email: user.email },
    req,
  });

  return {
    user: user.toJSON(),
    accessToken,
    refreshToken,
  };
}

export async function refreshSession(refreshToken) {
  if (!refreshToken) {
    throw new AppError('Refresh token missing', 401, 'MISSING_REFRESH_TOKEN');
  }

  let payload;
  try {
    payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  if (payload.type !== 'refresh' || !payload.sub) {
    throw new AppError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.active) {
    throw new AppError('Account not found or inactive', 401, 'UNAUTHORIZED');
  }

  return {
    user: user.toJSON(),
    accessToken: signAccessToken(user),
    refreshToken: signRefreshToken(user),
  };
}

