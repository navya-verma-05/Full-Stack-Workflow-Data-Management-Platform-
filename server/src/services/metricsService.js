import mongoose from 'mongoose';
import { Event, EVENT_STATUSES } from '../models/Event.js';
import { parseDateRange } from '../utils/queryHelpers.js';

function buildEventMatchStage({ from, to, sourceId }) {
  const match = {};
  const dateRange = parseDateRange(from, to);
  if (dateRange) {
    match.receivedAt = dateRange;
  }
  if (sourceId) {
    match.sourceId = new mongoose.Types.ObjectId(sourceId);
  }
  return match;
}

export async function getMetricsSummary({ from, to, sourceId }) {
  const match = buildEventMatchStage({ from, to, sourceId });

  // Single-pass $facet aggregation computes status totals, per-source breakdown, and latency stats.
  const [result] = await Event.aggregate([
    { $match: match },
    {
      $facet: {
        byStatus: [
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ],
        bySource: [
          {
            $group: {
              _id: '$sourceId',
              total: { $sum: 1 },
              processed: {
                $sum: { $cond: [{ $eq: ['$status', 'processed'] }, 1, 0] },
              },
              invalid: {
                $sum: { $cond: [{ $eq: ['$status', 'invalid'] }, 1, 0] },
              },
              failed: {
                $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
              },
              dead_letter: {
                $sum: { $cond: [{ $eq: ['$status', 'dead_letter'] }, 1, 0] },
              },
            },
          },
          {
            $lookup: {
              from: 'sources',
              localField: '_id',
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
              _id: 0,
              sourceId: '$_id',
              sourceName: { $ifNull: ['$source.name', 'Unknown Source'] },
              schemaType: { $ifNull: ['$source.schemaType', 'generic'] },
              active: { $ifNull: ['$source.active', false] },
              total: 1,
              processed: 1,
              invalid: 1,
              failed: 1,
              dead_letter: 1,
            },
          },
          { $sort: { total: -1 } },
        ],
        latency: [
          {
            $match: {
              status: 'processed',
              processedAt: { $ne: null },
            },
          },
          {
            $project: {
              durationMs: { $subtract: ['$processedAt', '$receivedAt'] },
            },
          },
          {
            $group: {
              _id: null,
              avgProcessingMs: { $avg: '$durationMs' },
            },
          },
        ],
      },
    },
  ]);

  const counts = Object.fromEntries(EVENT_STATUSES.map((s) => [s, 0]));
  let total = 0;

  for (const row of result?.byStatus || []) {
    if (row._id in counts) {
      counts[row._id] = row.count;
    }
    total += row.count;
  }

  const avgProcessingMs = Math.round(result?.latency?.[0]?.avgProcessingMs || 0);
  const successRate = total > 0 ? Math.round((counts.processed / total) * 1000) / 10 : 0;

  return {
    total,
    counts,
    successRate,
    avgProcessingMs,
    bySource: result?.bySource || [],
    range: {
      from: from || null,
      to: to || null,
      sourceId: sourceId || null,
    },
  };
}

export async function getMetricsTimeSeries({ from, to, sourceId, granularity = 'day' }) {
  const match = buildEventMatchStage({ from, to, sourceId });
  const dateFormat = granularity === 'hour' ? '%Y-%m-%dT%H:00:00Z' : '%Y-%m-%d';

  const buckets = await Event.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          $dateToString: {
            format: dateFormat,
            date: '$receivedAt',
            timezone: 'UTC',
          },
        },
        total: { $sum: 1 },
        received: {
          $sum: { $cond: [{ $eq: ['$status', 'received'] }, 1, 0] },
        },
        valid: {
          $sum: { $cond: [{ $eq: ['$status', 'valid'] }, 1, 0] },
        },
        processed: {
          $sum: { $cond: [{ $eq: ['$status', 'processed'] }, 1, 0] },
        },
        invalid: {
          $sum: { $cond: [{ $eq: ['$status', 'invalid'] }, 1, 0] },
        },
        failed: {
          $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] },
        },
        dead_letter: {
          $sum: { $cond: [{ $eq: ['$status', 'dead_letter'] }, 1, 0] },
        },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        bucket: '$_id',
        total: 1,
        received: 1,
        valid: 1,
        processed: 1,
        invalid: 1,
        failed: 1,
        dead_letter: 1,
      },
    },
  ]);

  return {
    granularity,
    buckets,
    range: {
      from: from || null,
      to: to || null,
      sourceId: sourceId || null,
    },
  };
}
