import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { api } from '../api/endpoints';
import { EmptyState, ErrorState, LoadingState } from '../components/StateFeedback';

export function OverviewPage() {
  const [sourceId, setSourceId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [granularity, setGranularity] = useState<'day' | 'hour'>('day');

  const sourcesQuery = useQuery({
    queryKey: ['sources', { limit: 100 }],
    queryFn: () => api.getSources({ limit: 100 }),
  });

  const summaryQuery = useQuery({
    queryKey: ['metrics-summary', { sourceId, from, to }],
    queryFn: () => api.getMetricsSummary({ sourceId, from, to }),
  });

  const tsQuery = useQuery({
    queryKey: ['metrics-timeseries', { sourceId, from, to, granularity }],
    queryFn: () => api.getMetricsTimeSeries({ sourceId, from, to, granularity }),
  });

  const summary = summaryQuery.data;
  const buckets = tsQuery.data?.buckets || [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Operational Overview</h1>
          <p className="mt-1 text-sm text-slate-400">
            Webhook ingestion throughput, validation outcomes, and retry health.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            aria-label="Filter by source"
            value={sourceId}
            onChange={(e) => setSourceId(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All sources</option>
            {(sourcesQuery.data?.items || []).map((src) => (
              <option key={src._id} value={src._id}>
                {src.name}
              </option>
            ))}
          </select>

          <input
            aria-label="From date"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          />
          <input
            aria-label="To date"
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          />

          <select
            aria-label="Time granularity"
            value={granularity}
            onChange={(e) => setGranularity(e.target.value as 'day' | 'hour')}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="day">Daily</option>
            <option value="hour">Hourly</option>
          </select>

          {(sourceId || from || to) && (
            <button
              type="button"
              onClick={() => {
                setSourceId('');
                setFrom('');
                setTo('');
              }}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {summaryQuery.isLoading ? (
        <LoadingState label="Computing metrics summary..." />
      ) : summaryQuery.isError ? (
        <ErrorState
          message={summaryQuery.error.message}
          onRetry={() => summaryQuery.refetch()}
        />
      ) : summary ? (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Total Events" value={summary.total} tone="default" />
            <MetricCard label="Processed" value={summary.counts.processed} tone="emerald" />
            <MetricCard label="Success Rate" value={`${summary.successRate}%`} tone="indigo" />
            <MetricCard label="Invalid" value={summary.counts.invalid} tone="amber" />
            <MetricCard
              label="Failed / Retrying"
              value={summary.counts.failed}
              tone="orange"
            />
            <MetricCard
              label="Dead-Letter"
              value={summary.counts.dead_letter}
              tone="rose"
              subtitle={`Avg ${summary.avgProcessingMs}ms`}
            />
          </div>

          <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
            <h2 className="mb-4 text-sm font-semibold text-slate-200">
              Event Volume Time Series ({granularity === 'day' ? 'Daily UTC' : 'Hourly UTC'})
            </h2>
            {tsQuery.isLoading ? (
              <LoadingState label="Loading time-series chart..." />
            ) : tsQuery.isError ? (
              <ErrorState message={tsQuery.error.message} onRetry={() => tsQuery.refetch()} />
            ) : buckets.length === 0 ? (
              <EmptyState title="No events in range" description="Adjust the date or source filter." />
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={buckets} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="bucket" stroke="#94a3b8" tick={{ fontSize: 11 }} />
                    <YAxis stroke="#94a3b8" tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f172a',
                        borderColor: '#334155',
                        fontSize: '12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} />
                    <Area
                      type="monotone"
                      dataKey="processed"
                      name="Processed"
                      stackId="1"
                      stroke="#10b981"
                      fill="#10b981"
                      fillOpacity={0.35}
                    />
                    <Area
                      type="monotone"
                      dataKey="invalid"
                      name="Invalid"
                      stackId="1"
                      stroke="#f59e0b"
                      fill="#f59e0b"
                      fillOpacity={0.35}
                    />
                    <Area
                      type="monotone"
                      dataKey="failed"
                      name="Failed"
                      stackId="1"
                      stroke="#f97316"
                      fill="#f97316"
                      fillOpacity={0.35}
                    />
                    <Area
                      type="monotone"
                      dataKey="dead_letter"
                      name="Dead-Letter"
                      stackId="1"
                      stroke="#f43f5e"
                      fill="#f43f5e"
                      fillOpacity={0.4}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>

          <section className="rounded-xl border border-slate-800 bg-slate-900/60 overflow-hidden">
            <div className="border-b border-slate-800 px-5 py-3.5">
              <h2 className="text-sm font-semibold text-slate-200">Per-Source Breakdown</h2>
            </div>
            {summary.bySource.length === 0 ? (
              <div className="p-6">
                <EmptyState title="No source activity yet" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-800 bg-slate-950/50 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-5 py-3">Source</th>
                      <th className="px-5 py-3">Schema</th>
                      <th className="px-5 py-3 text-right">Total</th>
                      <th className="px-5 py-3 text-right">Processed</th>
                      <th className="px-5 py-3 text-right">Invalid</th>
                      <th className="px-5 py-3 text-right">Failed</th>
                      <th className="px-5 py-3 text-right">Dead-Letter</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {summary.bySource.map((row) => (
                      <tr key={row.sourceId} className="hover:bg-slate-800/30">
                        <td className="px-5 py-3 font-medium text-white">{row.sourceName}</td>
                        <td className="px-5 py-3 text-xs text-slate-400">{row.schemaType}</td>
                        <td className="px-5 py-3 text-right text-slate-200">{row.total}</td>
                        <td className="px-5 py-3 text-right text-emerald-400">{row.processed}</td>
                        <td className="px-5 py-3 text-right text-amber-400">{row.invalid}</td>
                        <td className="px-5 py-3 text-right text-orange-400">{row.failed}</td>
                        <td className="px-5 py-3 text-right text-rose-400">{row.dead_letter}</td>
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
  tone,
  subtitle,
}: {
  label: string;
  value: string | number;
  tone: 'default' | 'emerald' | 'indigo' | 'amber' | 'orange' | 'rose';
  subtitle?: string;
}) {
  const toneClass = {
    default: 'text-white',
    emerald: 'text-emerald-400',
    indigo: 'text-indigo-400',
    amber: 'text-amber-400',
    orange: 'text-orange-400',
    rose: 'text-rose-400',
  }[tone];

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${toneClass}`}>{value}</p>
      {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
    </div>
  );
}

