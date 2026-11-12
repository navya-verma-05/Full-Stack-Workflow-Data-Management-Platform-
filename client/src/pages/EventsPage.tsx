import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '../api/endpoints';
import type { EventStatus } from '../types/api';
import { StatusBadge } from '../components/StatusBadge';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PaginationControls,
} from '../components/StateFeedback';

const STATUS_OPTIONS: EventStatus[] = [
  'received',
  'valid',
  'processed',
  'invalid',
  'failed',
  'dead_letter',
];

export function EventsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<EventStatus | ''>('');
  const [sourceId, setSourceId] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const sourcesQuery = useQuery({
    queryKey: ['sources', { limit: 100 }],
    queryFn: () => api.getSources({ limit: 100 }),
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
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Webhook Events</h1>
        <p className="mt-1 text-sm text-slate-400">
          Inspect ingested events, validation errors, retry attempts, and processing timelines.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
          <select
            aria-label="Status filter"
            value={status}
            onChange={(e) => {
              setPage(1);
              setStatus(e.target.value as EventStatus | '');
            }}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>

          <select
            aria-label="Source filter"
            value={sourceId}
            onChange={(e) => {
              setPage(1);
              setSourceId(e.target.value);
            }}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All sources</option>
            {(sourcesQuery.data?.items || []).map((s) => (
              <option key={s._id} value={s._id}>
                {s.name}
              </option>
            ))}
          </select>

          <input
            aria-label="From date"
            type="date"
            value={from}
            onChange={(e) => {
              setPage(1);
              setFrom(e.target.value);
            }}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          />

          <input
            aria-label="To date"
            type="date"
            value={to}
            onChange={(e) => {
              setPage(1);
              setTo(e.target.value);
            }}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          />

          <form onSubmit={handleApplySearch} className="flex gap-2 lg:col-span-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                aria-label="Search events"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search client, email, key..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500"
            >
              Search
            </button>
            {(status || sourceId || from || to || search) && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-xs text-slate-300 hover:bg-slate-700"
              >
                Clear
              </button>
            )}
          </form>
        </div>
      </div>

      {eventsQuery.isLoading ? (
        <LoadingState label="Loading events..." />
      ) : eventsQuery.isError ? (
        <ErrorState message={eventsQuery.error.message} onRetry={() => eventsQuery.refetch()} />
      ) : !eventsQuery.data || eventsQuery.data.items.length === 0 ? (
        <EmptyState title="No events match your filters" />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-800 bg-slate-950/60 text-xs uppercase text-slate-400">
                <tr>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Idempotency Key</th>
                  <th className="px-4 py-3">Attempts</th>
                  <th className="px-4 py-3">Received</th>
                  <th className="px-4 py-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {eventsQuery.data.items.map((ev) => (
                  <tr key={ev._id} className="hover:bg-slate-800/30">
                    <td className="px-4 py-3">
                      <StatusBadge status={ev.status} />
                    </td>
                    <td className="px-4 py-3 text-slate-200">
                      {ev.source?.name || 'Unknown'}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-300">
                      {ev.idempotencyKey}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {ev.attempts} / {ev.maxAttempts}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {new Date(ev.receivedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/events/${ev._id}`}
                        className="rounded-lg border border-slate-700 bg-slate-800/70 px-2.5 py-1 text-xs font-medium text-indigo-300 hover:bg-slate-700"
                      >
                        Inspect
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            pagination={eventsQuery.data.pagination}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

