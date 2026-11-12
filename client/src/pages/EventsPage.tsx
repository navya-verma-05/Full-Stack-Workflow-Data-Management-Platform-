import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Copy, ExternalLink, Search } from 'lucide-react';
import { api } from '../api/endpoints';
import { useToast } from '../context/ToastContext';
import type { EventStatus, WorkflowEvent } from '../types/api';
import { DateRangePicker } from '../components/DateRangePicker';
import { EventDrawer } from '../components/EventDrawer';
import { RelativeTime } from '../components/RelativeTime';
import {
  EmptyState,
  ErrorState,
  PaginationControls,
  SkeletonTable,
} from '../components/StateFeedback';
import { StatusBadge } from '../components/StatusBadge';

type StatusChip = '' | 'processed' | 'invalid' | 'failed' | 'dead_letter';

const STATUS_CHIPS: Array<{ value: StatusChip; label: string }> = [
  { value: '', label: 'All' },
  { value: 'processed', label: 'Processed' },
  { value: 'invalid', label: 'Invalid' },
  { value: 'failed', label: 'Failed' },
  { value: 'dead_letter', label: 'Dead-letter' },
];

function getInitialStatus(raw: string | null): StatusChip {
  if (raw === 'processed' || raw === 'invalid' || raw === 'failed' || raw === 'dead_letter') {
    return raw;
  }
  return '';
}

function getClientHint(evt: WorkflowEvent): string {
  const customer = evt.payload.customer as { name?: string; email?: string } | undefined;
  return String(
    evt.payload.fullName ||
      evt.payload.name ||
      customer?.name ||
      evt.payload.email ||
      customer?.email ||
      '—'
  );
}

export function EventsPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusChip>(() => getInitialStatus(searchParams.get('status')));
  const [sourceId, setSourceId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [drawerEvent, setDrawerEvent] = useState<WorkflowEvent | null>(null);

  const sourcesQuery = useQuery({
    queryKey: ['sources', { limit: 100 }],
    queryFn: () => api.getSources({ limit: 100 }),
  });

  const summaryCountsQuery = useQuery({
    queryKey: ['metrics-summary', { sourceId, from, to }],
    queryFn: () => api.getMetricsSummary({ sourceId, from, to }),
  });

  const eventsQuery = useQuery({
    queryKey: ['events', { page, limit: 20, status, sourceId, from, to, search }],
    queryFn: () =>
      api.getEvents({
        page,
        limit: 20,
        status,
        sourceId,
        from,
        to,
        search,
      }),
  });

  const handleStatusChange = (nextStatus: StatusChip) => {
    setPage(1);
    setStatus(nextStatus);
    if (nextStatus) {
      setSearchParams({ status: nextStatus }, { replace: true });
    } else {
      setSearchParams({}, { replace: true });
    }
  };

  const handleApplySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleClearFilters = () => {
    setPage(1);
    setStatus('');
    setSourceId('');
    setFrom('');
    setTo('');
    setSearchInput('');
    setSearch('');
    setSearchParams({}, { replace: true });
  };

  const handleCopyKey = async (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(key);
      toast.success('Copied idempotency key', key);
    } catch {
      toast.error('Clipboard unavailable');
    }
  };

  const counts = summaryCountsQuery.data?.counts;
  const totalEventsCount = summaryCountsQuery.data?.total;

  const getChipCount = (chip: StatusChip): number | undefined => {
    if (!summaryCountsQuery.data) return undefined;
    if (chip === '') return totalEventsCount;
    return counts?.[chip as EventStatus];
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Webhook Events
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Click any row to inspect payload and retry timeline in a quick drawer, or open the full page.
        </p>
      </div>

      {/* Status filter chips with counts */}
      <div
        role="group"
        aria-label="Filter events by status"
        className="flex flex-wrap items-center gap-2"
      >
        {STATUS_CHIPS.map((chip) => {
          const active = status === chip.value;
          const count = getChipCount(chip.value);
          return (
            <button
              key={chip.label}
              type="button"
              aria-pressed={active}
              onClick={() => handleStatusChange(chip.value)}
              className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                active
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              <span>{chip.label}</span>
              {typeof count === 'number' && (
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                    active
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                  }`}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filter toolbar */}
      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DateRangePicker
            from={from}
            to={to}
            onChange={({ from: nextFrom, to: nextTo }) => {
              setPage(1);
              setFrom(nextFrom);
              setTo(nextTo);
            }}
          />

          <select
            aria-label="Source filter"
            value={sourceId}
            onChange={(e) => {
              setPage(1);
              setSourceId(e.target.value);
            }}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
          >
            <option value="">All sources</option>
            {(sourcesQuery.data?.items || []).map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <form onSubmit={handleApplySearch} className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              aria-label="Search events"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search client name, email, error message, or idempotency key..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:bg-slate-950"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-500"
          >
            Search
          </button>
          {(status || sourceId || from || to || search) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {eventsQuery.isLoading ? (
        <SkeletonTable rows={6} cols={6} label="Loading webhook events..." />
      ) : eventsQuery.isError ? (
        <ErrorState message={eventsQuery.error.message} onRetry={() => eventsQuery.refetch()} />
      ) : !eventsQuery.data || eventsQuery.data.items.length === 0 ? (
        <EmptyState
          title="No events match these filters"
          description="Try selecting a different status chip, widening your date range, or clearing the search."
          actionLabel={status || sourceId || from || to || search ? 'Clear filters' : undefined}
          onAction={handleClearFilters}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-800">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/90 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Source & Client</th>
                  <th className="px-4 py-3 font-medium">Idempotency Key</th>
                  <th className="px-4 py-3 font-medium">Attempts</th>
                  <th className="px-4 py-3 font-medium">Received</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800/80 dark:text-slate-200">
                {eventsQuery.data.items.map((evt) => {
                  const sourceName =
                    evt.source?.name ||
                    (typeof evt.sourceId === 'object' ? evt.sourceId.name : String(evt.sourceId));

                  return (
                    <tr
                      key={evt._id}
                      onClick={() => setDrawerEvent(evt)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setDrawerEvent(evt);
                        }
                      }}
                      tabIndex={0}
                      className="cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3">
                        <StatusBadge status={evt.status} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-900 dark:text-white">{sourceName}</div>
                        <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {getClientHint(evt)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 dark:border-slate-800 dark:bg-slate-950/70">
                          <code
                            title={evt.idempotencyKey}
                            className="max-w-[140px] truncate font-mono text-[11px] text-slate-600 dark:text-slate-300"
                          >
                            {evt.idempotencyKey}
                          </code>
                          <button
                            type="button"
                            aria-label={`Copy key ${evt.idempotencyKey}`}
                            onClick={(e) => handleCopyKey(e, evt.idempotencyKey)}
                            className="rounded p-0.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-slate-600 dark:text-slate-300">
                        {evt.attempts} / {evt.maxAttempts}
                      </td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                        <RelativeTime value={evt.receivedAt} />
                      </td>
                      <td
                        className="px-4 py-3 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Link
                          to={`/events/${evt._id}`}
                          className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                        >
                          Inspect <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <PaginationControls pagination={eventsQuery.data.pagination} onPageChange={setPage} />
        </div>
      )}

      <EventDrawer
        eventId={drawerEvent?._id || null}
        initialEvent={drawerEvent}
        onClose={() => setDrawerEvent(null)}
      />
    </div>
  );
}
