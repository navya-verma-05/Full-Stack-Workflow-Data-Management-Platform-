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
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Normalized Records
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Client entities extracted and standardized across webhook schemas.
        </p>
      </div>

      <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60">
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
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
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
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:placeholder-slate-500"
            />
          </div>
        </div>

        <form onSubmit={handleApplySearch} className="flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              aria-label="Search records"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search client name, company, or email..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-500"
          >
            Search
          </button>
          {(sourceId || category || from || to || search) && (
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
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-800">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/90 dark:text-slate-400">
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
              <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800/80 dark:text-slate-200">
                {recordsQuery.data.items.map((rec) => (
                  <tr
                    key={rec._id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-white">
                        {rec.clientName}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {rec.clientEmail || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {rec.company || "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {rec.source?.name || rec.sourceId}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {rec.category || "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums font-medium text-slate-900 dark:text-slate-100">
                      {rec.amount
                        ? `${rec.amount.toLocaleString()} ${rec.currency || "USD"}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      <RelativeTime value={rec.normalizedAt} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        to={`/events/${rec.eventId}`}
                        className="inline-flex items-center gap-1 font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
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
