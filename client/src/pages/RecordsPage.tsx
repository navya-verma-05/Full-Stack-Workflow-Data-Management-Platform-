import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Search } from "lucide-react";
import { api } from "../api/endpoints";
import { DateRangePicker } from "../components/DateRangePicker";
import { RelativeTime } from "../components/RelativeTime";
import {
  EmptyState,
  ErrorState,
  PaginationControls,
  SkeletonTable,
} from "../components/StateFeedback";

export function RecordsPage() {
  const [page, setPage] = useState(1);
  const [sourceId, setSourceId] = useState("");
  const [category, setCategory] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const sourcesQuery = useQuery({
    queryKey: ["sources", { limit: 100 }],
    queryFn: () => api.getSources({ limit: 100 }),
  });

  const recordsQuery = useQuery({
    queryKey: [
      "records",
      { page, limit: 20, sourceId, category, from, to, search },
    ],
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
    setSourceId("");
    setCategory("");
    setFrom("");
    setTo("");
    setSearchInput("");
    setSearch("");
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#1B1B1A] dark:text-[#ECE9E2]">
          Normalized Records
        </h1>
        <p className="mt-0.5 text-xs text-[#6B6B66] dark:text-[#8E8B82]">
          Client entities extracted and standardized across webhook schemas.
        </p>
      </div>

      <div className="space-y-3 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <DateRangePicker
            from={from}
            to={to}
            fromAriaLabel="Records from date"
            toAriaLabel="Records to date"
            onChange={({ from: nextFrom, to: nextTo }) => {
              setPage(1);
              setFrom(nextFrom);
              setTo(nextTo);
            }}
          />

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              aria-label="Record source filter"
              value={sourceId}
              onChange={(e) => {
                setPage(1);
                setSourceId(e.target.value);
              }}
              className="rounded border border-[var(--border-hairline)] bg-[var(--bg-page)] px-3 py-1.5 text-xs text-[#1B1B1A] focus:border-[#1B1B1A] focus:outline-none dark:bg-[#141413] dark:text-[#ECE9E2] dark:focus:border-[#ECE9E2]"
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
              placeholder="Category (e.g. negotiation)"
              className="rounded border border-[var(--border-hairline)] bg-[var(--bg-page)] px-3 py-1.5 text-xs text-[#1B1B1A] placeholder-[#6B6B66] focus:border-[#1B1B1A] focus:outline-none dark:bg-[#141413] dark:text-[#ECE9E2] dark:placeholder-[#8E8B82] dark:focus:border-[#ECE9E2]"
            />
          </div>
        </div>

        <form onSubmit={handleApplySearch} className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-[#6B6B66] dark:text-[#8E8B82]" />
            <input
              aria-label="Search records"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search client name, company, or email..."
              className="w-full rounded border border-[var(--border-hairline)] bg-[var(--bg-page)] py-2 pl-8 pr-3 text-xs text-[#1B1B1A] placeholder-[#6B6B66] focus:border-[#1B1B1A] focus:bg-[var(--bg-surface)] focus:outline-none dark:bg-[#141413] dark:text-[#ECE9E2] dark:placeholder-[#8E8B82] dark:focus:border-[#ECE9E2]"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-[#1B1B1A] px-3.5 py-2 text-xs font-medium text-[#F6F4EF] hover:bg-[#32312E] dark:bg-[#ECE9E2] dark:text-[#1B1B1A] dark:hover:bg-white"
          >
            Search
          </button>
          {(sourceId || category || from || to || search) && (
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

      {recordsQuery.isLoading ? (
        <SkeletonTable
          rows={6}
          cols={7}
          label="Loading normalized records..."
        />
      ) : recordsQuery.isError ? (
        <ErrorState
          message={recordsQuery.error.message}
          onRetry={() => recordsQuery.refetch()}
        />
      ) : !recordsQuery.data || recordsQuery.data.items.length === 0 ? (
        <EmptyState
          title="No normalized records match these filters"
          description="Adjust your filters or ingest valid events to generate normalized client records."
          actionLabel={
            sourceId || category || from || to || search
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
                  <th className="px-4 py-3 font-medium">Client</th>
                  <th className="px-4 py-3 font-medium">Company</th>
                  <th className="px-4 py-3 font-medium">Source</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Normalized</th>
                  <th className="px-4 py-3 text-right font-medium">Event</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)] text-[#1B1B1A] dark:text-[#ECE9E2]">
                {recordsQuery.data.items.map((rec) => (
                  <tr
                    key={rec._id}
                    className="hover:bg-[var(--bg-subtle)]/60 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#1B1B1A] dark:text-[#ECE9E2]">
                        {rec.clientName}
                      </div>
                      <div className="font-mono text-[11px] text-[#6B6B66] dark:text-[#8E8B82]">
                        {rec.clientEmail || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#6B6B66] dark:text-[#8E8B82]">
                      {rec.company || "—"}
                    </td>
                    <td className="px-4 py-3 text-[#6B6B66] dark:text-[#8E8B82]">
                      {rec.source?.name || rec.sourceId}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-[#6B6B66] dark:text-[#8E8B82]">
                      {rec.category || "—"}
                    </td>
                    <td className="px-4 py-3 font-mono tabular-nums font-semibold text-[#1B1B1A] dark:text-[#ECE9E2]">
                      {rec.amount
                        ? `${rec.amount.toLocaleString()} ${rec.currency || "USD"}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-[#6B6B66] dark:text-[#8E8B82]">
                      <RelativeTime value={rec.normalizedAt} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/events/${rec.eventId}`}
                        className="inline-flex items-center gap-1 font-medium text-[#1B1B1A] underline decoration-[#C2BFB6] hover:decoration-[#1B1B1A] dark:text-[#ECE9E2] dark:decoration-[#4A4843] dark:hover:decoration-white"
                      >
                        View <ExternalLink className="h-3 w-3" />
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
