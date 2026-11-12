import mongoose from 'mongoose';
import { Event } from '../models/Event.js';
import { RecordModel } from '../models/Record.js';
import { AuditLog } from '../models/AuditLog.js';
import { AppError } from '../utils/AppError.js';
import {
  buildPaginationMeta,
  escapeRegex,
  parseDateRange,
} from '../utils/queryHelpers.js';

export async function listEvents({
  page = 1,
  limit = 20,
  status,
  sourceId,
  from,
  to,
  search,
}) {
  const match = {};
  if (status) match.status = status;
  if (sourceId) match.sourceId = new mongoose.Types.ObjectId(sourceId);
  const dateRange = parseDateRange(from, to);
  if (dateRange) match.receivedAt = dateRange;

  if (search) {
    const safeRegex = new RegExp(escapeRegex(search), 'i');
    match.$or = [
      { idempotencyKey: safeRegex },
      { 'errors.message': safeRegex },
      { 'payload.clientName': safeRegex },
      { 'payload.fullName': safeRegex },
      { 'payload.name': safeRegex },
      { 'payload.email': safeRegex },
      { 'payload.clientEmail': safeRegex },
      { 'payload.customer.name': safeRegex },
      { 'payload.customer.email': safeRegex },
    ];
  }

  const skip = (page - 1) * limit;

  const [agg] = await Event.aggregate([
    { $match: match },
    { $sort: { receivedAt: -1, _id: -1 } },
    {
      $facet: {
        items: [
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'sources',
              localField: 'sourceId',
              foreignField: '_id',
              pipeline: [
                {
                  $project: {
                    name: 1,
                    schemaType: 1,
                    active: 1,
                  },
                },
              ],
              as: 'source',
            },
          },
          {
            $unwind: {
              path: '$source',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              simulatedFailuresRemaining: 0,
              __v: 0,
            },
          },
        ],
        totalCount: [{ $count: 'count' }],
      },
    },
  ]);

  const items = agg?.items || [];
  const total = agg?.totalCount?.[0]?.count || 0;

  return {
    items,
    pagination: buildPaginationMeta(page, limit, total),
  };
}

export async function getEventDetail(id) {
  const event = await Event.findById(id)
    .populate({
      path: 'sourceId',
      select: 'name schemaType active',
    })
    .populate({
      path: 'recordId',
      select: '-__v',
    });

  if (!event) {
    throw new AppError('Event not found', 404, 'EVENT_NOT_FOUND');
  }

  return event.toJSON();
}

export async function listRecords({
  page = 1,
  limit = 20,
  sourceId,
  category,
  from,
  to,
  search,
}) {
  const match = {};
  if (sourceId) match.sourceId = new mongoose.Types.ObjectId(sourceId);
  if (category) match.category = category;
  const dateRange = parseDateRange(from, to);
  if (dateRange) match.normalizedAt = dateRange;

  if (search) {
    const safeRegex = new RegExp(escapeRegex(search), 'i');
    match.$or = [
      { clientName: safeRegex },
      { clientEmail: safeRegex },
      { company: safeRegex },
      { externalId: safeRegex },
    ];
  }

  const skip = (page - 1) * limit;

  const [agg] = await RecordModel.aggregate([
    { $match: match },
    { $sort: { normalizedAt: -1, _id: -1 } },
    {
      $facet: {
        items: [
          { $skip: skip },
          { $limit: limit },
          {
            $lookup: {
              from: 'sources',
              localField: 'sourceId',
              foreignField: '_id',
              pipeline: [
                {
                  $project: {
                    name: 1,
                    schemaType: 1,
                    active: 1,
                  },
                },
              ],
              as: 'source',
            },
          },
          {
            $unwind: {
              path: '$source',
              preserveNullAndEmptyArrays: true,
            },
          },
          {
            $project: {
              __v: 0,
            },
          },
        ],
        totalCount: [{ $count: 'count' }],
      },
    },
  ]);

  const items = agg?.items || [];
  const total = agg?.totalCount?.[0]?.count || 0;

  return {
    items,
    pagination: buildPaginationMeta(page, limit, total),
  };
}

export async function listAuditLogs({
  page = 1,
  limit = 20,
  action,
  resourceType,
  actorId,
  from,
  to,
  search,
}) {
  const filter = {};
  if (action) filter.action = action;
  if (resourceType) filter.resourceType = resourceType;
  if (actorId) filter.actorId = new mongoose.Types.ObjectId(actorId);
  const dateRange = parseDateRange(from, to);
  if (dateRange) filter.createdAt = dateRange;

  if (search) {
    const safeRegex = new RegExp(escapeRegex(search), 'i');
    filter.$or = [
      { actorEmail: safeRegex },
      { action: safeRegex },
      { resourceType: safeRegex },
      { resourceId: safeRegex },
    ];
  }

  const skip = (page - 1) * limit;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  return {
    items,
    pagination: buildPaginationMeta(page, limit, total),
  };
}
