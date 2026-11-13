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
        <h1 className="text-xl font-bold tracking-tight text-[#1B1B1A] dark:text-[#ECE9E2]">
          Audit Log
        </h1>
        <p className="mt-0.5 text-xs text-[#6B6B66] dark:text-[#8E8B82]">
          Immutable security and administrative event trail (admin access only).
        </p>
      </div>

      <div className="space-y-3 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
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
              className="rounded border border-[var(--border-hairline)] bg-[var(--bg-page)] px-3 py-1.5 text-xs text-[#1B1B1A] placeholder-[#6B6B66] focus:border-[#1B1B1A] focus:outline-none dark:bg-[#141413] dark:text-[#ECE9E2] dark:placeholder-[#8E8B82] dark:focus:border-[#ECE9E2]"
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
              className="rounded border border-[var(--border-hairline)] bg-[var(--bg-page)] px-3 py-1.5 text-xs text-[#1B1B1A] placeholder-[#6B6B66] focus:border-[#1B1B1A] focus:outline-none dark:bg-[#141413] dark:text-[#ECE9E2] dark:placeholder-[#8E8B82] dark:focus:border-[#ECE9E2]"
            />
          </div>
        </div>

        <form onSubmit={handleApplySearch} className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#6B6B66] dark:text-[#8E8B82]" />
            <input
              aria-label="Search audit logs"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search actor email, action, or resource ID..."
              className="w-full rounded border border-[var(--border-hairline)] bg-[var(--bg-page)] py-2 pl-8 pr-3 text-xs text-[#1B1B1A] placeholder-[#6B6B66] focus:border-[#1B1B1A] focus:bg-[var(--bg-surface)] focus:outline-none dark:bg-[#141413] dark:text-[#ECE9E2] dark:placeholder-[#8E8B82] dark:focus:border-[#ECE9E2]"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-[#1B1B1A] px-3.5 py-2 text-xs font-medium text-[#F6F4EF] hover:bg-[#32312E] dark:bg-[#ECE9E2] dark:text-[#1B1B1A] dark:hover:bg-white"
          >
            Search
          </button>
          {(action || resourceType || from || to || search) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded border border-[var(--border-hairline)] bg-[var(--bg-page)] px-3 py-2 text-xs font-medium text-[#6B6B66] hover:text-[#1B1B1A] hover:bg-[var(--bg-subtle)] dark:bg-[#141413] dark:text-[#8E8B82] dark:hover:text-[#ECE9E2]"
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
        <div className="overflow-hidden rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border-hairline)] text-left text-xs">
              <thead className="bg-[var(--bg-page)] text-[#6B6B66] dark:text-[#8E8B82] font-mono uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-4 py-3 font-medium">Timestamp</th>
                  <th className="px-4 py-3 font-medium">Actor</th>
                  <th className="px-4 py-3 font-medium">Action</th>
                  <th className="px-4 py-3 font-medium">Resource</th>
                  <th className="px-4 py-3 font-medium">IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)] text-[#1B1B1A] dark:text-[#ECE9E2]">
                {auditQuery.data.items.map((log) => (
                  <tr
                    key={log._id}
                    className="hover:bg-[var(--bg-subtle)]/60 transition-colors"
                  >
                    <td className="px-4 py-3 text-[#6B6B66] dark:text-[#8E8B82]">
                      <RelativeTime value={log.createdAt} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#1B1B1A] dark:text-[#ECE9E2]">
                        {log.actorEmail || "system"}
                      </div>
                      <div className="font-mono text-[11px] text-[#6B6B66] dark:text-[#8E8B82]">
                        {log.actorRole}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] font-semibold text-[#1B1B1A] dark:text-[#ECE9E2]">
                      {log.action}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[#6B6B66] dark:text-[#8E8B82]">
                      {log.resourceType}
                      {log.resourceId ? ` (${log.resourceId})` : ""}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[#6B6B66] dark:text-[#8E8B82]">
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
