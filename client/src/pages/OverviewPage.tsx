import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertOctagon,
  ArrowRight,
  Radio,
  RotateCcw,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import type { WorkflowEvent } from '../types/api';
import { formatBucketLabel } from '../utils/date';
import { DateRangePicker } from '../components/DateRangePicker';
import { RelativeTime } from '../components/RelativeTime';
import { EmptyState, ErrorState, SkeletonOverview } from '../components/StateFeedback';
import { StatusBadge } from '../components/StatusBadge';

type ChartSeriesKey = 'processed' | 'invalid' | 'failed' | 'dead_letter';

const SERIES_META: Array<{
  key: ChartSeriesKey;
  label: string;
  color: string;
  dotClass: string;
}> = [
  { key: 'processed', label: 'Processed', color: '#10b981', dotClass: 'bg-emerald-500' },
  { key: 'invalid', label: 'Invalid', color: '#f59e0b', dotClass: 'bg-amber-500' },
  { key: 'failed', label: 'Failed', color: '#f97316', dotClass: 'bg-orange-500' },
  { key: 'dead_letter', label: 'Dead-letter', color: '#f43f5e', dotClass: 'bg-rose-500' },
];

function getEventSourceName(evt: WorkflowEvent): string {
  if (evt.source?.name) return evt.source.name;
  if (typeof evt.sourceId === 'object' && evt.sourceId !== null) return evt.sourceId.name;
  return String(evt.sourceId);
}

function getAttentionSummary(evt: WorkflowEvent): string {
  if (evt.errors.length > 0) {
    return evt.errors[0].message;
  }
  const latestLog = evt.processingLogs[evt.processingLogs.length - 1];
  return latestLog?.message || `Event in ${evt.status} state`;
}

export function OverviewPage() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const toast = useToast();
  const queryClient = useQueryClient();

  const [sourceId, setSourceId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [granularity, setGranularity] = useState<'day' | 'hour'>('day');
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [visibleSeries, setVisibleSeries] = useState<Record<ChartSeriesKey, boolean>>({
    processed: true,
    invalid: true,
    failed: true,
    dead_letter: true,
  });

  const canReplay = user?.role === 'admin' || user?.role === 'manager';
  const refetchInterval = autoRefresh ? 30_000 : false;

  const sourcesQuery = useQuery({
    queryKey: ['sources', { limit: 100 }],
    queryFn: () => api.getSources({ limit: 100 }),
  });

  const summaryQuery = useQuery({
    queryKey: ['metrics-summary', { sourceId, from, to }],
    queryFn: () => api.getMetricsSummary({ sourceId, from, to }),
    refetchInterval,
  });

  const tsQuery = useQuery({
    queryKey: ['metrics-timeseries', { sourceId, from, to, granularity }],
    queryFn: () => api.getMetricsTimeSeries({ sourceId, from, to, granularity }),
    refetchInterval,
  });

  const attentionQuery = useQuery({
    queryKey: ['events-needs-attention', { sourceId }],
    queryFn: () =>
      api.getEvents({
        status: 'failed,dead_letter',
        sourceId,
        limit: 6,
      }),
    refetchInterval,
  });

  const replayMutation = useMutation({
    mutationFn: (id: string) => api.replayEvent(id),
    onSuccess: (res) => {
      toast.success('Event queued for replay', res.event.idempotencyKey);
      queryClient.invalidateQueries({ queryKey: ['events-needs-attention'] });
      queryClient.invalidateQueries({ queryKey: ['metrics-summary'] });
      queryClient.invalidateQueries({ queryKey: ['metrics-timeseries'] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
    onError: (err) => {
      toast.error('Replay failed', (err as Error).message);
    },
  });

  const toggleSeries = (key: ChartSeriesKey) => {
    setVisibleSeries((prev) => {
      const enabledCount = Object.values(prev).filter(Boolean).length;
      if (enabledCount === 1 && prev[key]) return prev;
      return { ...prev, [key]: !prev[key] };
    });
  };

  const summary = summaryQuery.data;
  const buckets = tsQuery.data?.buckets || [];
  const attentionItems = attentionQuery.data?.items || [];

  const isDark = theme === 'dark';
  const gridStroke = isDark ? '#1e293b' : '#e2e8f0';
  const axisColor = isDark ? '#94a3b8' : '#64748b';
  const tooltipStyle = {
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
    borderColor: isDark ? '#334155' : '#e2e8f0',
    borderRadius: '10px',
    fontSize: '12px',
    color: isDark ? '#f8fafc' : '#0f172a',
  };

  return (
    <div className="space-y-6">
      {/* Header & Live controls */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Operational Overview
          </h1>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-400">
            <span>Webhook ingestion throughput, validation outcomes, and retry health.</span>
            {summary?.lastEventReceivedAt && (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Last event received <RelativeTime value={summary.lastEventReceivedAt} />
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          aria-pressed={autoRefresh}
          onClick={() => setAutoRefresh((prev) => !prev)}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            autoRefresh
              ? 'border-emerald-500/40 bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
          }`}
        >
          <Radio className={`h-3.5 w-3.5 ${autoRefresh ? 'animate-pulse text-emerald-500' : ''}`} />
          Auto-refresh (30s): {autoRefresh ? 'On' : 'Off'}
        </button>
      </div>

      {/* Filters toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
        <DateRangePicker
          from={from}
          to={to}
          onChange={({ from: nextFrom, to: nextTo }) => {
            setFrom(nextFrom);
            setTo(nextTo);
          }}
        />

        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="Filter by source"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="">All sources</option>
            {(sourcesQuery.data?.items || []).map((src) => (
              <option key={src._id} value={src._id}>
                {src.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Time granularity"
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as 'day' | 'hour')}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="day">Daily buckets</option>
            <option value="hour">Hourly buckets</option>
          </select>

          {(sourceId || from || to) && (
            <button
              type="button"
              onClick={() => {
                setSourceId('');
                setFrom('');
                setTo('');
              }}
              className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {summaryQuery.isLoading ? (
        <SkeletonOverview label="Loading overview metrics..." />
      ) : summaryQuery.isError ? (
        <ErrorState message={summaryQuery.error.message} onRetry={() => summaryQuery.refetch()} />
      ) : summary ? (
        <>
          {/* KPI cards with period deltas */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            <MetricCard
              label="Total Events"
              value={summary.total}
              delta={summary.deltas?.totalPct}
              deltaUnit="%"
              comparisonLabel={summary.deltas?.comparisonLabel}
              positiveIsGood
            />
            <MetricCard
              label="Processed"
              value={summary.counts.processed}
              tone="emerald"
              delta={summary.deltas?.processedPct}
              deltaUnit="%"
              comparisonLabel={summary.deltas?.comparisonLabel}
              positiveIsGood
            />
            <MetricCard
              label="Success Rate"
              value={`${summary.successRate}%`}
              tone="indigo"
              delta={summary.deltas?.successRatePts}
              deltaUnit=" pts"
              comparisonLabel={summary.deltas?.comparisonLabel}
              positiveIsGood
            />
            <MetricCard
              label="Invalid Schema"
              value={summary.counts.invalid}
              tone="amber"
              delta={summary.deltas?.invalidPct}
              deltaUnit="%"
              comparisonLabel={summary.deltas?.comparisonLabel}
              positiveIsGood={false}
            />
            <MetricCard
              label="Failed / DLQ"
              value={summary.counts.failed + summary.counts.dead_letter}
              tone="rose"
              delta={summary.deltas?.attentionPct}
              deltaUnit="%"
              comparisonLabel={summary.deltas?.comparisonLabel}
              positiveIsGood={false}
            />
            <MetricCard
              label="Avg Processing"
              value={`${summary.avgProcessingMs} ms`}
              tone="slate"
              delta={summary.deltas?.avgProcessingMsPct}
              deltaUnit="%"
              comparisonLabel={summary.deltas?.comparisonLabel}
              positiveIsGood={false}
            />
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {/* Stacked Bar Chart with Interactive Legend */}
            <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60 lg:col-span-2">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Event Outcomes Over Time
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Click legend pills to isolate statuses and spot incident spikes
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {SERIES_META.map((s) => {
                    const active = visibleSeries[s.key];
                    return (
                      <button
                        key={s.key}
                        type="button"
                        aria-pressed={active}
                        onClick={() => toggleSeries(s.key)}
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-opacity ${
                          active
                            ? 'border-slate-300 bg-slate-50 text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100'
                            : 'border-slate-200 bg-transparent text-slate-400 opacity-50 dark:border-slate-800 dark:text-slate-500'
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${s.dotClass}`} />
                        {s.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {tsQuery.isLoading ? (
                <div className="h-72 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/60" />
              ) : buckets.length === 0 ? (
                <EmptyState
                  title="No time-series buckets"
                  description="No events match the active date range or source filter."
                />
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={buckets} barCategoryGap="18%">
                      <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} vertical={false} />
                      <XAxis
                        dataKey="bucket"
                        stroke={axisColor}
                        fontSize={11}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(val) => formatBucketLabel(String(val), granularity)}
                      />
                      <YAxis
                        stroke={axisColor}
                        fontSize={11}
                        allowDecimals={false}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={tooltipStyle}
                        labelFormatter={(label) => formatBucketLabel(String(label), granularity)}
                        cursor={{ fill: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(15,23,42,0.04)' }}
                      />
                      {SERIES_META.map(
                        (s) =>
                          visibleSeries[s.key] && (
                            <Bar
                              key={s.key}
                              dataKey={s.key}
                              name={s.label}
                              stackId="events"
                              fill={s.color}
                              radius={[0, 0, 0, 0]}
                            />
                          )
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </section>

            {/* Needs Attention Panel */}
            <section className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60">
              <div className="mb-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertOctagon className="h-4 w-4 text-rose-500" />
                  <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
                    Needs Attention
                  </h2>
                </div>
                <Link
                  to="/events?status=dead_letter"
                  className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                >
                  All failures <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              {attentionQuery.isLoading ? (
                <div className="space-y-2.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800/60"
                    />
                  ))}
                </div>
              ) : attentionQuery.isError ? (
                <ErrorState message={attentionQuery.error.message} />
              ) : attentionItems.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 p-6 text-center dark:border-slate-800">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">
                    All pipelines healthy
                  </p>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                    No failed or dead-letter events match this filter.
                  </p>
                </div>
              ) : (
                <ul className="space-y-2.5">
                  {attentionItems.map((evt) => (
                    <li
                      key={evt._id}
                      className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-950/60 dark:hover:border-slate-700"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <StatusBadge status={evt.status} />
                          <span className="truncate text-xs font-medium text-slate-900 dark:text-slate-200">
                            {getEventSourceName(evt)}
                          </span>
                        </div>
                        <span className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                          <RelativeTime value={evt.receivedAt} />
                        </span>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                        {getAttentionSummary(evt)}
                      </p>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[11px]">
                        <span className="font-mono text-slate-500 dark:text-slate-400">
                          Attempts {evt.attempts}/{evt.maxAttempts}
                        </span>
                        <div className="flex items-center gap-2">
                          {canReplay && (
                            <button
                              type="button"
                              disabled={replayMutation.isPending}
                              onClick={() => replayMutation.mutate(evt._id)}
                              className="inline-flex items-center gap-1 rounded border border-indigo-500/30 bg-indigo-50 px-2 py-0.5 font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-500/15 dark:text-indigo-300 dark:hover:bg-indigo-500/25"
                            >
                              <RotateCcw className="h-3 w-3" />
                              Replay
                            </button>
                          )}
                          <Link
                            to={`/events/${evt._id}`}
                            className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
                          >
                            Inspect →
                          </Link>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          {/* Per-Source Breakdown Table */}
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60">
            <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
              Source Reliability Breakdown
            </h2>
            {summary.bySource.length === 0 ? (
              <EmptyState
                title="No source activity"
                description="Events ingested from configured sources will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-800">
                  <thead className="text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-2.5 pr-4 font-medium">Source</th>
                      <th className="px-3 py-2.5 font-medium">Schema</th>
                      <th className="px-3 py-2.5 text-right font-medium">Total</th>
                      <th className="px-3 py-2.5 text-right font-medium">Processed</th>
                      <th className="px-3 py-2.5 text-right font-medium">Invalid</th>
                      <th className="px-3 py-2.5 text-right font-medium">Failed</th>
                      <th className="px-3 py-2.5 text-right font-medium">Dead-letter</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800/70 dark:text-slate-200">
                    {summary.bySource.map((row) => (
                      <tr key={row.sourceId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                        <td className="py-3 pr-4 font-medium text-slate-900 dark:text-white">
                          {row.sourceName}
                        </td>
                        <td className="px-3 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                          {row.schemaType}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums font-medium">{row.total}</td>
                        <td className="px-3 py-3 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                          {row.processed}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">
                          {row.invalid}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-orange-600 dark:text-orange-400">
                          {row.failed}
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums text-rose-600 dark:text-rose-400">
                          {row.dead_letter}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone = 'slate',
  delta,
  deltaUnit = '%',
  comparisonLabel,
  positiveIsGood = true,
}: {
  label: string;
  value: number | string;
  tone?: 'slate' | 'emerald' | 'indigo' | 'amber' | 'rose';
  delta?: number | null;
  deltaUnit?: string;
  comparisonLabel?: string;
  positiveIsGood?: boolean;
}) {
  const toneClass = {
    slate: 'text-slate-900 dark:text-white',
    emerald: 'text-emerald-600 dark:text-emerald-400',
    indigo: 'text-indigo-600 dark:text-indigo-400',
    amber: 'text-amber-600 dark:text-amber-400',
    rose: 'text-rose-600 dark:text-rose-400',
  }[tone];

  let deltaBadge: JSX.Element | null = null;
  if (typeof delta === 'number') {
    const isUp = delta > 0;
    const isFlat = delta === 0;
    const isGood = isFlat ? null : positiveIsGood ? isUp : !isUp;
    const badgeColor = isFlat
      ? 'text-slate-500 dark:text-slate-400'
      : isGood
        ? 'text-emerald-600 dark:text-emerald-400'
        : 'text-rose-600 dark:text-rose-400';
    const sign = isUp ? '+' : '';
    deltaBadge = (
      <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${badgeColor}`}>
        {!isFlat && (isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />)}
        {sign}
        {delta}
        {deltaUnit}
        {comparisonLabel ? (
          <span className="font-normal text-slate-400 dark:text-slate-500">
            {' '}
            {comparisonLabel}
          </span>
        ) : null}
      </span>
    );
  } else if (delta === null && comparisonLabel) {
    deltaBadge = (
      <span className="text-[11px] text-slate-400 dark:text-slate-500">
        New {comparisonLabel}
      </span>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-semibold tabular-nums ${toneClass}`}>{value}</p>
      <div className="mt-1.5 min-h-[16px]">{deltaBadge}</div>
    </div>
  );
}
