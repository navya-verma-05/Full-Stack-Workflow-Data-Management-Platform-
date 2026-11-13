import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Copy, Search } from "lucide-react";
import { api } from "../api/endpoints";
import { useToast } from "../context/ToastContext";
import type { EventStatus, WorkflowEvent } from "../types/api";
import { DateRangePicker } from "../components/DateRangePicker";
import { EventDrawer } from "../components/EventDrawer";
import { RelativeTime } from "../components/RelativeTime";
import {
  EmptyState,
  ErrorState,
  SkeletonTable,
} from "../components/StateFeedback";
import { StatusBadge } from "../components/StatusBadge";

type StatusChip = "" | EventStatus;

const STATUS_CHIPS: Array<{ label: string; value: StatusChip }> = [
  { label: "All", value: "" },
  { label: "Processed", value: "processed" },
  { label: "Invalid Schema", value: "invalid" },
  { label: "Failed", value: "failed" },
  { label: "Dead Letter", value: "dead_letter" },
];

function getInitialStatus(param: string | null): StatusChip {
  if (!param) return "";
  const match = STATUS_CHIPS.find((c) => c.value === param);
  return match ? match.value : "";
}

function getClientHint(evt: WorkflowEvent): string {
  const p = evt.payload;
  if (!p || typeof p !== "object") return "—";
  if ("clientName" in p && p.clientName) return String(p.clientName);
  if ("fullName" in p && p.fullName) return String(p.fullName);
  if ("name" in p && p.name) return String(p.name);
  if (
    "customer" in p &&
    typeof p.customer === "object" &&
    p.customer &&
    "name" in p.customer
  ) {
    return String(p.customer.name);
  }
  return "—";
}

export function EventsPage() {
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<StatusChip>(() =>
    getInitialStatus(searchParams.get("status")),
  );
  const [sourceId, setSourceId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [drawerEvent, setDrawerEvent] = useState<WorkflowEvent | null>(null);

  const sourcesQuery = useQuery({
    queryKey: ["sources", { limit: 100 }],
    queryFn: () => api.getSources({ limit: 100 }),
  });

  const summaryCountsQuery = useQuery({
    queryKey: ["metrics-summary", { sourceId, from, to }],
    queryFn: () => api.getMetricsSummary({ sourceId, from, to }),
  });

  const eventsQuery = useQuery({
    queryKey: [
      "events",
      { page, limit: 20, status, sourceId, from, to, search },
    ],
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
    setStatus("");
    setSourceId("");
    setFrom("");
    setTo("");
    setSearchInput("");
    setSearch("");
    setSearchParams({}, { replace: true });
  };

  const handleCopyKey = async (e: React.MouseEvent, key: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(key);
      toast.success("Copied idempotency key", key);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  const counts = summaryCountsQuery.data?.counts;
  const totalEventsCount = summaryCountsQuery.data?.total;

  const getChipCount = (chip: StatusChip): number | undefined => {
    if (!summaryCountsQuery.data) return undefined;
    if (chip === "") return totalEventsCount;
    return counts?.[chip as EventStatus];
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-[#1B1B1A] dark:text-[#ECE9E2]">
          Webhook Events
        </h1>
        <p className="mt-0.5 text-xs text-[#6B6B66] dark:text-[#8E8B82]">
          Click any event row to open the quick inspector drawer, or inspect its
          full retry timeline.
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
              className={`inline-flex items-center gap-2 rounded border px-3 py-1 text-xs font-medium transition-colors ${
                active
                  ? "border-[#1B1B1A] bg-[#1B1B1A] text-[#F6F4EF] font-semibold dark:border-[#ECE9E2] dark:bg-[#ECE9E2] dark:text-[#141413]"
                  : "border-[var(--border-hairline)] bg-[var(--bg-surface)] text-[var(--text-ink)] hover:bg-[var(--bg-subtle)]"
              }`}
            >
              <span>{chip.label}</span>
              {typeof count === "number" && (
                <span
                  className={`rounded px-1.5 py-0.2 font-mono text-[10px] tabular-nums ${
                    active
                      ? "bg-white/20 text-white dark:bg-black/20 dark:text-black font-bold"
                      : "bg-[var(--bg-subtle)] text-[#6B6B66] dark:text-[#8E8B82]"
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
      <div className="space-y-3 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3.5">
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
            className="rounded border border-[var(--border-hairline)] bg-[var(--bg-page)] px-2.5 py-1 text-xs text-[var(--text-ink)] focus:outline-none"
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
            <Search className="pointer-events-none absolute left-2.5 top-2 h-3.5 w-3.5 text-[#6B6B66] dark:text-[#8E8B82]" />
            <input
              aria-label="Search events"
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search client, email, error, or idempotency key..."
              className="w-full rounded border border-[var(--border-hairline)] bg-[var(--bg-page)] py-1.5 pl-8 pr-3 text-xs font-mono text-[var(--text-ink)] placeholder-[#6B6B66] focus:border-[#1B1B1A] focus:outline-none dark:placeholder-[#8E8B82] dark:focus:border-[#ECE9E2]"
            />
          </div>
          <button
            type="submit"
            className="rounded bg-[#1B1B1A] px-3.5 py-1.5 text-xs font-medium text-[#F6F4EF] hover:bg-[#2E2E2C] dark:bg-[#ECE9E2] dark:text-[#141413] dark:hover:bg-[#FFFFFF] transition-colors"
          >
            Search
          </button>
          {(status || sourceId || from || to || search) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-ink)] hover:bg-[var(--bg-subtle)]"
            >
              Clear
            </button>
          )}
        </form>
      </div>

      {eventsQuery.isLoading ? (
        <SkeletonTable rows={6} cols={6} label="Loading webhook events..." />
      ) : eventsQuery.isError ? (
        <ErrorState
          message={eventsQuery.error.message}
          onRetry={() => eventsQuery.refetch()}
        />
      ) : !eventsQuery.data || eventsQuery.data.items.length === 0 ? (
        <EmptyState
          title="No events match these filters"
          description="Try selecting a different status chip, widening your date range, or clearing the search."
          actionLabel={
            status || sourceId || from || to || search
              ? "Clear filters"
              : undefined
          }
          onAction={handleClearFilters}
        />
      ) : (
        <div className="overflow-hidden rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)]">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-[var(--border-hairline)] text-left text-xs">
              <thead className="bg-[var(--bg-page)] text-[var(--text-muted)] font-mono text-[10px] uppercase">
                <tr>
                  <th className="px-3.5 py-2.5 font-medium">Status</th>
                  <th className="px-3.5 py-2.5 font-medium">Source & Client</th>
                  <th className="px-3.5 py-2.5 font-medium">Idempotency Key</th>
                  <th className="px-3.5 py-2.5 font-medium">Attempts</th>
                  <th className="px-3.5 py-2.5 font-medium">Received</th>
                  <th className="px-3.5 py-2.5 text-right font-medium">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-hairline)] text-[var(--text-ink)]">
                {eventsQuery.data.items.map((evt) => {
                  const sourceName =
                    evt.source?.name ||
                    (typeof evt.sourceId === "object"
                      ? evt.sourceId.name
                      : String(evt.sourceId));

                  return (
                    <tr
                      key={evt._id}
                      onClick={() => setDrawerEvent(evt)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setDrawerEvent(evt);
                        }
                      }}
                      tabIndex={0}
                      className="cursor-pointer transition-colors hover:bg-[var(--bg-subtle)] focus:bg-[var(--bg-subtle)]"
                    >
                      <td className="px-3.5 py-2.5">
                        <StatusBadge status={evt.status} />
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="font-semibold text-[var(--text-ink)]">
                          {sourceName}
                        </div>
                        <div className="truncate font-mono text-[11px] text-[var(--text-muted)]">
                          {getClientHint(evt)}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="inline-flex items-center gap-1.5 rounded border border-[var(--border-hairline)] bg-[var(--bg-page)] px-2 py-0.5">
                          <code
                            title={evt.idempotencyKey}
                            className="max-w-[140px] truncate font-mono text-[11px] text-[var(--text-ink)]"
                          >
                            {evt.idempotencyKey}
                          </code>
                          <button
                            type="button"
                            aria-label={`Copy key ${evt.idempotencyKey}`}
                            onClick={(e) =>
                              handleCopyKey(e, evt.idempotencyKey)
                            }
                            className="rounded p-0.5 text-[var(--text-muted)] hover:text-[var(--text-ink)]"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5 font-mono tabular-nums text-[var(--text-muted)]">
                        {evt.attempts} / {evt.maxAttempts}
                      </td>
                      <td className="px-3.5 py-2.5 text-[var(--text-muted)] font-mono text-[11px]">
                        <RelativeTime value={evt.receivedAt} />
                      </td>
                      <td
                        className="px-3.5 py-2.5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Link
                          to={`/events/${evt._id}`}
                          className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--text-ink)] hover:underline"
                        >
                          <span>Open</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {eventsQuery.data.pagination && (
            <div className="flex items-center justify-between border-t border-[var(--border-hairline)] px-4 py-2.5 text-xs text-[var(--text-muted)]">
              <span>
                Page{" "}
                <strong className="font-mono text-[var(--text-ink)]">
                  {eventsQuery.data.pagination.page}
                </strong>{" "}
                of{" "}
                <strong className="font-mono text-[var(--text-ink)]">
                  {eventsQuery.data.pagination.totalPages}
                </strong>{" "}
                ({eventsQuery.data.pagination.total} events)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={eventsQuery.data.pagination.page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={
                    eventsQuery.data.pagination.page >=
                    eventsQuery.data.pagination.totalPages
                  }
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Slide-over quick inspector drawer */}
      <EventDrawer event={drawerEvent} onClose={() => setDrawerEvent(null)} />
    </div>
  );
}
