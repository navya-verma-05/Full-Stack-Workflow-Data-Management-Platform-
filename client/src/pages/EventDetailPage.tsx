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
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="space-y-2">
          <Link
            to="/events"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to events
          </Link>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
              Event {event._id}
            </h1>
            <StatusBadge status={event.status} />
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>Idempotency key:</span>
            <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-slate-800 dark:bg-slate-800 dark:text-slate-200">
              {event.idempotencyKey}
            </code>
            <button
              type="button"
              onClick={handleCopyKey}
              aria-label="Copy idempotency key"
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
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
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-600/20 transition-all hover:bg-indigo-500 disabled:opacity-60"
          >
            <RotateCcw className="h-4 w-4" />
            {replayMutation.isPending ? "Queuing replay..." : "Replay Event"}
          </button>
        )}
      </div>

      {/* Metadata summary strip */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
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
      {event.errors.length > 0 && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-50 p-4 dark:bg-rose-950/20">
          <h2 className="text-sm font-semibold text-rose-800 dark:text-rose-200">
            Validation & Downstream Errors ({event.errors.length})
          </h2>
          <ul className="mt-2 space-y-1.5 text-xs text-rose-700 dark:text-rose-100">
            {event.errors.map((err, idx) => (
              <li key={`${err.field}-${idx}`}>
                <span className="font-mono font-semibold text-rose-600 dark:text-rose-300">
                  {err.field || "payload"}
                </span>
                : {err.message}{" "}
                <span className="text-rose-500/80 dark:text-rose-300/70">
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
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-50/70 p-4 dark:bg-emerald-950/20">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-200">
                  Normalized Client Record
                </h2>
                <span className="font-mono text-[11px] text-emerald-700 dark:text-emerald-300">
                  {record._id}
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <dt className="text-emerald-700/80 dark:text-emerald-300/70">
                    Client
                  </dt>
                  <dd className="mt-0.5 font-semibold text-slate-900 dark:text-white">
                    {record.clientName}
                  </dd>
                </div>
                <div>
                  <dt className="text-emerald-700/80 dark:text-emerald-300/70">
                    Email
                  </dt>
                  <dd className="mt-0.5 text-slate-800 dark:text-slate-200">
                    {record.clientEmail || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-emerald-700/80 dark:text-emerald-300/70">
                    Company
                  </dt>
                  <dd className="mt-0.5 text-slate-800 dark:text-slate-200">
                    {record.company || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-emerald-700/80 dark:text-emerald-300/70">
                    Category & Value
                  </dt>
                  <dd className="mt-0.5 font-mono text-slate-800 dark:text-slate-200">
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
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900/40">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              No Normalized Record Created
            </h2>
            <p className="mt-1.5 max-w-sm text-xs text-slate-500 dark:text-slate-400">
              Records are only created after schema validation passes and worker
              processing completes.
            </p>
          </div>
        )}
      </div>

      {/* Retry & Processing Timeline */}
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <h2 className="mb-4 text-sm font-semibold text-slate-900 dark:text-white">
          Retry & Processing Timeline
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
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p
        className={`mt-1 text-xs font-medium text-slate-900 dark:text-slate-100 ${
          mono ? "font-mono" : ""
        }`}
      >
        {value}
      </p>
    </div>
  );
}
