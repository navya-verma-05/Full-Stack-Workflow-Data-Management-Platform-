import mongoose from 'mongoose';
import { Event, EVENT_STATUSES } from '../models/Event.js';
import { parseDateRange } from '../utils/queryHelpers.js';

const DAY_MS = 86_400_000;

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

function parseEndDate(to) {
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(to);
  return new Date(isDateOnly ? `${to}T23:59:59.999Z` : to);
}

function resolveComparisonWindows({ from, to }) {
  const now = new Date();

  if (from && to) {
    const curStart = new Date(from);
    const curEnd = parseEndDate(to);
    const spanMs = Math.max(DAY_MS, curEnd.getTime() - curStart.getTime() + 1);
    return {
      currentWindow: { $gte: curStart, $lte: curEnd },
      prevStart: new Date(curStart.getTime() - spanMs),
      prevEnd: new Date(curStart.getTime() - 1),
      comparisonLabel: 'vs previous period',
      useCurrentMatchDirectly: true,
    };
  }

  if (from) {
    const curStart = new Date(from);
    const spanMs = Math.max(DAY_MS, now.getTime() - curStart.getTime());
    return {
      currentWindow: { $gte: curStart, $lte: now },
      prevStart: new Date(curStart.getTime() - spanMs),
      prevEnd: new Date(curStart.getTime() - 1),
      comparisonLabel: 'vs previous period',
      useCurrentMatchDirectly: true,
    };
  }

  if (to) {
    const curEnd = parseEndDate(to);
    const curStart = new Date(curEnd.getTime() - 7 * DAY_MS + 1);
    const prevEnd = new Date(curStart.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - 7 * DAY_MS + 1);
    return {
      currentWindow: { $gte: curStart, $lte: curEnd },
      prevStart,
      prevEnd,
      comparisonLabel: 'vs prior 7d',
      useCurrentMatchDirectly: false,
    };
  }

  // Unfiltered overview compares the rolling 7d window against the prior 7d window.
  const curStart = new Date(now.getTime() - 7 * DAY_MS);
  const prevEnd = new Date(curStart.getTime() - 1);
  const prevStart = new Date(curStart.getTime() - 7 * DAY_MS);
  return {
    currentWindow: { $gte: curStart, $lte: now },
    prevStart,
    prevEnd,
    comparisonLabel: '7d vs prior 7d',
    useCurrentMatchDirectly: false,
  };
}

async function aggregateWindowTotals(match) {
  const [agg] = await Event.aggregate([
    { $match: match },
    {
      $facet: {
        byStatus: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        latency: [
          { $match: { status: 'processed', processedAt: { $ne: null } } },
          { $project: { durationMs: { $subtract: ['$processedAt', '$receivedAt'] } } },
          { $group: { _id: null, avgProcessingMs: { $avg: '$durationMs' } } },
        ],
      },
    },
  ]);

  const counts = Object.fromEntries(EVENT_STATUSES.map((s) => [s, 0]));
  let total = 0;
  for (const row of agg?.byStatus || []) {
    if (row._id in counts) counts[row._id] = row.count;
    total += row.count;
  }

  const avgProcessingMs = Math.round(agg?.latency?.[0]?.avgProcessingMs || 0);
  const successRate = total > 0 ? Math.round((counts.processed / total) * 1000) / 10 : 0;

  return {
    total,
    counts,
    successRate,
    avgProcessingMs,
  };
}

function pctDelta(current, previous) {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getMetricsSummary({ from, to, sourceId }) {
  const match = buildEventMatchStage({ from, to, sourceId });
  const sourceFilter = sourceId ? { sourceId: new mongoose.Types.ObjectId(sourceId) } : {};

  // Single-pass $facet aggregation computes status totals, per-source breakdown, and latency stats.
  const [[result], latestEvent] = await Promise.all([
    Event.aggregate([
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
    ]),
    Event.findOne(sourceFilter).sort({ receivedAt: -1 }).select('receivedAt').lean(),
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

  const { currentWindow, prevStart, prevEnd, comparisonLabel, useCurrentMatchDirectly } =
    resolveComparisonWindows({ from, to });

  const [comparisonCurrent, previous] = await Promise.all([
    useCurrentMatchDirectly
      ? Promise.resolve({ total, counts, successRate, avgProcessingMs })
      : aggregateWindowTotals({ ...sourceFilter, receivedAt: currentWindow }),
    aggregateWindowTotals({
      ...sourceFilter,
      receivedAt: { $gte: prevStart, $lte: prevEnd },
    }),
  ]);

  const deltas = {
    totalPct: pctDelta(comparisonCurrent.total, previous.total),
    processedPct: pctDelta(comparisonCurrent.counts.processed, previous.counts.processed),
    invalidPct: pctDelta(comparisonCurrent.counts.invalid, previous.counts.invalid),
    failedPct: pctDelta(comparisonCurrent.counts.failed, previous.counts.failed),
    deadLetterPct: pctDelta(comparisonCurrent.counts.dead_letter, previous.counts.dead_letter),
    attentionPct: pctDelta(
      comparisonCurrent.counts.failed + comparisonCurrent.counts.dead_letter,
      previous.counts.failed + previous.counts.dead_letter
    ),
    successRatePts: Math.round((comparisonCurrent.successRate - previous.successRate) * 10) / 10,
    avgProcessingMsPct: pctDelta(comparisonCurrent.avgProcessingMs, previous.avgProcessingMs),
    comparisonLabel,
  };

  return {
    total,
    counts,
    successRate,
    avgProcessingMs,
    lastEventReceivedAt: latestEvent?.receivedAt ? new Date(latestEvent.receivedAt).toISOString() : null,
    previousPeriod: {
      total: previous.total,
      counts: previous.counts,
      successRate: previous.successRate,
      avgProcessingMs: previous.avgProcessingMs,
      from: prevStart.toISOString(),
      to: prevEnd.toISOString(),
      comparisonLabel,
    },
    deltas,
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
