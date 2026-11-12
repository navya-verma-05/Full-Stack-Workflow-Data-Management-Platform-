import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '../api/endpoints';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PaginationControls,
} from '../components/StateFeedback';

export function RecordsPage() {
  const [page, setPage] = useState(1);
  const [sourceId, setSourceId] = useState('');
  const [category, setCategory] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const sourcesQuery = useQuery({
    queryKey: ['sources', { limit: 100 }],
    queryFn: () => api.getSources({ limit: 100 }),
  });

  const recordsQuery = useQuery({
    queryKey: ['records', { page, limit: 20, sourceId, category, from, to, search }],
    queryFn: () =>
      api.getRecords({
        page,
        limit: 20,
        sourceId,
        category,
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
    setSourceId('');
    setCategory('');
    setFrom('');
    setTo('');
    setSearchInput('');
    setSearch('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Normalized Records</h1>
        <p className="mt-1 text-sm text-slate-400">
          Client entities extracted and standardized from valid webhook events.
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
          <select
            aria-label="Record source filter"
            value={sourceId}
            onChange={(e) => {
              setPage(1);
              setSourceId(e.target.value);
            }}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All sources</option>
            {(sourcesQuery.data?.items || []).map((src) => (
              <option key={src._id} value={src._id}>
                {src.name}
              </option>
            ))}
          </select>

          <input
            aria-label="Category filter"
            type="text"
            value={category}
            onChange={(e) => {
              setPage(1);
              setCategory(e.target.value);
            }}
            placeholder="Category (e.g. lead, deal)"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />

          <input
            aria-label="Records from date"
            type="date"
            value={from}
            onChange={(e) => {
              setPage(1);
              setFrom(e.target.value);
            }}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          />

          <input
            aria-label="Records to date"
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
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                aria-label="Search records"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search client, company, or email..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500"
            >
              Search
            </button>
            {(sourceId || category || from || to || search) && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="rounded-lg border border-slate-700 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800"
              >
                Clear
              </button>
            )}
          </form>
        </div>
      </div>

      {recordsQuery.isLoading ? (
        <LoadingState label="Loading normalized records..." />
      ) : recordsQuery.isError ? (
        <ErrorState
          message={recordsQuery.error.message}
          onRetry={() => recordsQuery.refetch()}
        />
      ) : !recordsQuery.data || recordsQuery.data.items.length === 0 ? (
        <EmptyState
          title="No normalized records match these filters"
          description="Adjust your filters or ingest valid events to generate client records."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Normalized</th>
                  <th className="px-4 py-3 font-medium">Event</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-200">
                {recordsQuery.data.items.map((rec) => (
                  <tr key={rec._id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{rec.clientName}</div>
                      <div className="text-[11px] text-slate-400">{rec.clientEmail || '—'}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{rec.company || '—'}</td>
                    <td className="px-4 py-3 text-slate-300">
                      {rec.source?.name || rec.sourceId}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-300">
                      {rec.category || '—'}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-200">
                      {rec.amount ? `${rec.amount.toLocaleString()} ${rec.currency || 'USD'}` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(rec.normalizedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/events/${rec.eventId}`}
                        className="font-medium text-indigo-400 hover:text-indigo-300"
                      >
                        View event
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            pagination={recordsQuery.data.pagination}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

