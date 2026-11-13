import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, RotateCcw } from "lucide-react";
import { api } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import type { NormalizedRecord, Source } from "../types/api";
import { formatDateTime } from "../utils/date";
import { JsonCodeBlock } from "../components/JsonCodeBlock";
import { RelativeTime } from "../components/RelativeTime";
import { RetryTimeline } from "../components/RetryTimeline";
import { ErrorState, LoadingState } from "../components/StateFeedback";
import { StatusBadge } from "../components/StatusBadge";

export function EventDetailPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: ["event-detail", id],
    queryFn: () => api.getEventDetail(id),
    enabled: Boolean(id),
  });

  const replayMutation = useMutation({
    mutationFn: () => api.replayEvent(id),
    onSuccess: (res) => {
      toast.success("Event queued for replay", res.event.idempotencyKey);
      queryClient.invalidateQueries({ queryKey: ["event-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["events-needs-attention"] });
      queryClient.invalidateQueries({ queryKey: ["metrics-summary"] });
    },
    onError: (err) => {
      toast.error("Replay failed", (err as Error).message);
    },
  });

  if (detailQuery.isLoading) {
    return <LoadingState label="Loading event details..." />;
  }

  if (detailQuery.isError) {
    return (
      <ErrorState
        message={detailQuery.error.message}
        onRetry={() => detailQuery.refetch()}
      />
    );
  }

  const event = detailQuery.data?.event;
  if (!event) return null;

  const canReplay =
    (user?.role === "admin" || user?.role === "manager") &&
    (event.status === "failed" || event.status === "dead_letter");

  const source =
    typeof event.sourceId === "object" && event.sourceId !== null
      ? (event.sourceId as Pick<
          Source,
          "_id" | "name" | "schemaType" | "active"
        >)
      : null;

  const record =
    typeof event.recordId === "object" && event.recordId !== null
      ? (event.recordId as NormalizedRecord)
      : null;

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(event.idempotencyKey);
      toast.success("Copied idempotency key", event.idempotencyKey);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & prominent Replay action */}
      <div className="flex flex-wrap items-start justify-between gap-4 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
        <div className="space-y-2">
          <Link
            to="/events"
            className="inline-flex items-center gap-1.5 font-mono text-xs text-[var(--text-muted)] hover:text-[var(--text-ink)] hover:underline"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to events</span>
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-lg font-bold text-[var(--text-ink)]">
              Event {event._id}
            </h1>
            <StatusBadge status={event.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="font-mono text-[11px]">Idempotency key:</span>
            <code className="rounded border border-[var(--border-hairline)] bg-[var(--bg-page)] px-2 py-0.5 font-mono text-[11px] text-[var(--text-ink)]">
              {event.idempotencyKey}
            </code>
            <button
              type="button"
              onClick={handleCopyKey}
              aria-label="Copy idempotency key"
              className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-ink)]"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {canReplay && (
          <button
            type="button"
            disabled={replayMutation.isPending}
            onClick={() => replayMutation.mutate()}
            className="inline-flex items-center gap-2 rounded bg-[#1B1B1A] px-4 py-2 text-xs font-semibold text-[#F6F4EF] hover:bg-[#2E2E2C] dark:bg-[#ECE9E2] dark:text-[#141413] dark:hover:bg-[#FFFFFF] transition-colors disabled:opacity-60"
          >
            <RotateCcw className="h-4 w-4" />
            <span>
              {replayMutation.isPending ? "Queuing replay..." : "Replay Event"}
            </span>
          </button>
        )}
      </div>

      {/* Metadata summary strip */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <InfoTile
          label="Source"
          value={source?.name || String(event.sourceId)}
        />
        <InfoTile label="Schema Type" value={source?.schemaType || "—"} mono />
        <InfoTile
          label="Received"
          value={
            <>
              <RelativeTime value={event.receivedAt} /> ·{" "}
              {formatDateTime(event.receivedAt)}
            </>
          }
        />
        <InfoTile
          label="Processed"
          value={
            event.processedAt ? (
              <>
                <RelativeTime value={event.processedAt} /> ·{" "}
                {formatDateTime(event.processedAt)}
              </>
            ) : (
              "Pending / Not processed"
            )
          }
        />
      </div>

      {/* Errors banner if present */}
      {event.errors && event.errors.length > 0 && (
        <div className="rounded border border-[#FECACA] bg-[#FEE2E2] p-4 text-xs dark:border-[#541919] dark:bg-[#381111]">
          <h2 className="font-semibold text-[#B91C1C] dark:text-[#F87171]">
            Validation & Downstream Errors ({event.errors.length})
          </h2>
          <ul className="mt-1.5 space-y-1 text-[#B91C1C] dark:text-[#F87171]">
            {event.errors.map((err, idx) => (
              <li key={`${err.field}-${idx}`}>
                <span className="font-mono font-semibold">
                  {err.field || "payload"}
                </span>
                : {err.message}{" "}
                <span className="font-mono text-[10px] opacity-75">
                  ({err.code})
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Side-by-side Raw Payload vs Normalized Record */}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <JsonCodeBlock
          title="Raw Webhook Payload"
          subtitle="Verified JSON envelope stored on ingestion"
          data={event.payload}
        />

        {record ? (
          <div className="flex flex-col gap-4">
            <div className="rounded border border-[#A5D6A7] bg-[#E8F5E9] p-4 text-xs dark:border-[#1E4627] dark:bg-[#132E1B]">
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="font-bold uppercase tracking-wider text-[#2E7D32] dark:text-[#4ADE80]">
                  Normalized Client Record
                </h2>
                <span className="font-mono text-[11px] text-[#2E7D32] dark:text-[#4ADE80]">
                  {record._id}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-3">
                <div>
                  <dt className="text-[10px] uppercase font-mono text-[#2E7D32] dark:text-[#4ADE80]">
                    Client
                  </dt>
                  <dd className="mt-0.5 font-semibold text-[#1B1B1A] dark:text-[#ECE9E2]">
                    {record.clientName}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase font-mono text-[#2E7D32] dark:text-[#4ADE80]">
                    Email
                  </dt>
                  <dd className="mt-0.5 font-mono text-[#1B1B1A] dark:text-[#ECE9E2]">
                    {record.clientEmail || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase font-mono text-[#2E7D32] dark:text-[#4ADE80]">
                    Company
                  </dt>
                  <dd className="mt-0.5 font-medium text-[#1B1B1A] dark:text-[#ECE9E2]">
                    {record.company || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase font-mono text-[#2E7D32] dark:text-[#4ADE80]">
                    Category & Value
                  </dt>
                  <dd className="mt-0.5 font-mono text-[#1B1B1A] dark:text-[#ECE9E2]">
                    {record.category || "—"}
                    {record.amount
                      ? ` · ${record.amount.toLocaleString()} ${record.currency || "USD"}`
                      : ""}
                  </dd>
                </div>
              </dl>
            </div>

            <JsonCodeBlock
              title="Normalized Record Document"
              subtitle={`Normalized ${formatDateTime(record.normalizedAt)}`}
              data={record}
              maxHeightClass="max-h-72"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center rounded border border-dashed border-[var(--border-hairline)] bg-[var(--bg-surface)] p-8 text-center">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-ink)]">
              No Normalized Record Created
            </h2>
            <p className="mt-1 max-w-sm text-xs text-[var(--text-muted)]">
              This event has not been normalized into a business record (status:{" "}
              {event.status}). Once processed, the normalized entity appears
              here side-by-side with the raw ingestion envelope.
            </p>
          </div>
        )}
      </div>

      {/* Retry Timeline */}
      <section className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-wider text-[var(--text-ink)]">
          Retry & Execution Timeline
        </h2>
        <RetryTimeline event={event} />
      </section>
    </div>
  );
}

function InfoTile({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3">
      <p className="font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
        {label}
      </p>
      <div
        className={`mt-1 text-xs font-semibold text-[var(--text-ink)] ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
