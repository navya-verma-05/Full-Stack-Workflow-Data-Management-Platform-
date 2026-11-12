import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { api } from '../api/endpoints';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PaginationControls,
} from '../components/StateFeedback';

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [resourceType, setResourceType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const auditQuery = useQuery({
    queryKey: ['audit-logs', { page, limit: 20, action, resourceType, from, to, search }],
    queryFn: () =>
      api.getAuditLogs({
        page,
        limit: 20,
        action,
        resourceType,
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
    setAction('');
    setResourceType('');
    setFrom('');
    setTo('');
    setSearchInput('');
    setSearch('');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-white">Audit Log</h1>
        <p className="mt-1 text-sm text-slate-400">
          Immutable security and administrative event trail (admin access only).
        </p>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
          <input
            aria-label="Action filter"
            type="text"
            value={action}
            onChange={(e) => {
              setPage(1);
              setAction(e.target.value);
            }}
            placeholder="Action (e.g. source.created)"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />

          <input
            aria-label="Resource type filter"
            type="text"
            value={resourceType}
            onChange={(e) => {
              setPage(1);
              setResourceType(e.target.value);
            }}
            placeholder="Resource (source, user, event)"
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />

          <input
            aria-label="Audit from date"
            type="date"
            value={from}
            onChange={(e) => {
              setPage(1);
              setFrom(e.target.value);
            }}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          />

          <input
            aria-label="Audit to date"
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
                aria-label="Search audit logs"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search actor email, action, or ID..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500"
            >
              Search
            </button>
            {(action || resourceType || from || to || search) && (
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

      {auditQuery.isLoading ? (
        <LoadingState label="Loading audit logs..." />
      ) : auditQuery.isError ? (
        <ErrorState
          message={auditQuery.error.message}
          onRetry={() => auditQuery.refetch()}
        />
      ) : !auditQuery.data || auditQuery.data.items.length === 0 ? (
        <EmptyState
          title="No audit events match your filters"
          description="Try broadening the action, resource type, or date filters."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Resource</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-200">
                {auditQuery.data.items.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3 text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{log.actorEmail || 'system'}</div>
                      <div className="text-[11px] text-slate-400">{log.actorRole}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-indigo-300">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-300">
                      {log.resourceType}
                      {log.resourceId ? ` (${log.resourceId})` : ''}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                      {log.ipAddress || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            pagination={auditQuery.data.pagination}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

