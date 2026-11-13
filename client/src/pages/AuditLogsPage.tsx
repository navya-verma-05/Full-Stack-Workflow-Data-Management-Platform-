import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { api } from "../api/endpoints";
import { DateRangePicker } from "../components/DateRangePicker";
import { RelativeTime } from "../components/RelativeTime";
import {
  EmptyState,
  ErrorState,
  PaginationControls,
  SkeletonTable,
} from "../components/StateFeedback";

export function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const auditQuery = useQuery({
    queryKey: [
      "audit-logs",
      { page, limit: 20, action, resourceType, from, to, search },
    ],
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
    setAction("");
    setResourceType("");
    setFrom("");
    setTo("");
    setSearchInput("");
    setSearch("");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Audit Log
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Immutable security and administrative event trail (admin access only).
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DateRangePicker
            from={from}
            to={to}
            fromAriaLabel="Audit from date"
            toAriaLabel="Audit to date"
            onChange={({ from: nextFrom, to: nextTo }) => {
              setPage(1);
              setFrom(nextFrom);
              setTo(nextTo);
            }}
          />

          <div className="flex flex-wrap items-center gap-2.5">
            <input
              aria-label="Action filter"
              type="text"
              value={action}
              onChange={(e) => {
                setPage(1);
                setAction(e.target.value);
              }}
              placeholder="Action (e.g. source.create)"
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder-slate-500"
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
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder-slate-500"
            />
          </div>
        </div>

        <form onSubmit={handleApplySearch} className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              aria-label="Search audit logs"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search actor email, action, or resource ID..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-500"
          >
            Search
          </button>
          {(action || resourceType || from || to || search) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {auditQuery.isLoading ? (
        <SkeletonTable rows={6} cols={5} label="Loading audit logs..." />
      ) : auditQuery.isError ? (
        <ErrorState
          message={auditQuery.error.message}
          onRetry={() => auditQuery.refetch()}
        />
      ) : !auditQuery.data || auditQuery.data.items.length === 0 ? (
        <EmptyState
          title="No audit events match your filters"
          description="Try broadening the action, resource type, or date filters."
          actionLabel={
            action || resourceType || from || to || search
              ? "Clear filters"
              : undefined
          }
          onAction={handleClearFilters}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-800">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/90 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Resource</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800/80 dark:text-slate-200">
                {auditQuery.data.items.map((log) => (
                  <tr
                    key={log._id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      <RelativeTime value={log.createdAt} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {log.actorEmail || "system"}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {log.actorRole}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-indigo-700 dark:text-indigo-300">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {log.resourceType}
                      {log.resourceId ? ` (${log.resourceId})` : ""}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {log.ipAddress || "—"}
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
