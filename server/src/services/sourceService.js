import { Source } from '../models/Source.js';
import { AppError } from '../utils/AppError.js';
import { encryptSecret, generateSecret, sha256Hex } from '../utils/crypto.js';
import { recordAuditLog } from './auditService.js';

export async function listSources({ page = 1, limit = 20, active, schemaType }) {
  const filter = {};
  if (typeof active === 'boolean') filter.active = active;
  if (schemaType) filter.schemaType = schemaType;

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    Source.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Source.countDocuments(filter),
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

export async function getSourceById(id) {
  const source = await Source.findById(id);
  if (!source) {
    throw new AppError('Source not found', 404, 'SOURCE_NOT_FOUND');
  }
  return source;
}

export async function createSource(
  { name, description = '', schemaType = 'generic', active = true },
  { actor, req = null }
) {
  const existing = await Source.findOne({ name });
  if (existing) {
    throw new AppError('Source with this name already exists', 409, 'SOURCE_EXISTS');
  }

  const apiKey = generateSecret(24, 'wpk_');
  const signingSecret = generateSecret(32, 'whsec_');

  const source = await Source.create({
    name,
    description,
    schemaType,
    apiKeyHash: sha256Hex(apiKey),
    apiKeyPrefix: apiKey.slice(0, 10),
    signingSecretHash: sha256Hex(signingSecret),
    signingSecretEncrypted: encryptSecret(signingSecret),
    active,
    secretRotatedAt: new Date(),
    createdBy: actor?._id || null,
  });

  await recordAuditLog({
    actor,
    action: 'source.create',
    resourceType: 'source',
    resourceId: source._id,
    metadata: { name: source.name, schemaType: source.schemaType, active: source.active },
    req,
  });

  return {
    source: source.toJSON(),
    credentials: {
      apiKey,
      signingSecret,
    },
  };
}

export async function updateSource(id, updates, { actor, req = null }) {
  const source = await Source.findById(id);
  if (!source) {
    throw new AppError('Source not found', 404, 'SOURCE_NOT_FOUND');
  }

  const previous = {
    name: source.name,
    description: source.description,
    schemaType: source.schemaType,
    active: source.active,
  };

  if (updates.name !== undefined) source.name = updates.name;
  if (updates.description !== undefined) source.description = updates.description;
  if (updates.schemaType !== undefined) source.schemaType = updates.schemaType;
  if (updates.active !== undefined) source.active = updates.active;

  await source.save();

  await recordAuditLog({
    actor,
    action: 'source.update',
    resourceType: 'source',
    resourceId: source._id,
    metadata: { previous, updated: updates },
    req,
  });

  return source.toJSON();
}

export async function rotateSourceSecret(id, { actor, req = null }) {
  const source = await Source.findById(id);
  if (!source) {
    throw new AppError('Source not found', 404, 'SOURCE_NOT_FOUND');
  }

  const signingSecret = generateSecret(32, 'whsec_');
  source.signingSecretHash = sha256Hex(signingSecret);
  source.signingSecretEncrypted = encryptSecret(signingSecret);
  source.secretRotatedAt = new Date();
  await source.save();

  await recordAuditLog({
    actor,
    action: 'source.rotate_secret',
    resourceType: 'source',
    resourceId: source._id,
    metadata: { name: source.name, secretRotatedAt: source.secretRotatedAt },
    req,
  });

  return {
    source: source.toJSON(),
    signingSecret,
  };
}
