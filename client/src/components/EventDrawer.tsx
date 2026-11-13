import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Copy, RotateCcw, X } from "lucide-react";
import { api } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import type { Source, WorkflowEvent } from "../types/api";
import { formatDateTime } from "../utils/date";
import { JsonCodeBlock } from "./JsonCodeBlock";
import { RelativeTime } from "./RelativeTime";
import { RetryTimeline } from "./RetryTimeline";
import { ErrorState, LoadingState } from "./StateFeedback";
import { StatusBadge } from "./StatusBadge";

interface EventDrawerProps {
  eventId: string | null;
  initialEvent?: WorkflowEvent | null;
  onClose: () => void;
}

export function EventDrawer({
  eventId,
  initialEvent,
  onClose,
}: EventDrawerProps) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!eventId) return undefined;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [eventId, onClose]);

  const detailQuery = useQuery({
    queryKey: ["event-detail", eventId],
    queryFn: () => api.getEventDetail(eventId!),
    enabled: Boolean(eventId),
  });

  const replayMutation = useMutation({
    mutationFn: () => api.replayEvent(eventId!),
    onSuccess: () => {
      toast.success(
        "Event queued for replay",
        `Idempotency key ${event?.idempotencyKey || ""}`,
      );
      queryClient.invalidateQueries({ queryKey: ["event-detail", eventId] });
      queryClient.invalidateQueries({ queryKey: ["events"] });
      queryClient.invalidateQueries({ queryKey: ["metrics-summary"] });
    },
    onError: (err) => {
      toast.error("Replay failed", (err as Error).message);
    },
  });

  if (!eventId) return null;

  const event = detailQuery.data?.event || initialEvent;
  const sourceObj =
    event && typeof event.sourceId === "object" && event.sourceId !== null
      ? (event.sourceId as Pick<
          Source,
          "_id" | "name" | "schemaType" | "active"
        >)
      : event?.source || null;

  const canReplay =
    Boolean(event) &&
    (user?.role === "admin" || user?.role === "manager") &&
    (event!.status === "failed" || event!.status === "dead_letter");

  const handleCopyKey = async () => {
    if (!event) return;
    try {
      await navigator.clipboard.writeText(event.idempotencyKey);
      toast.success("Copied idempotency key", event.idempotencyKey);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Event quick inspector"
      className="fixed inset-0 z-40 flex justify-end bg-slate-950/50 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-2xl flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950"
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2.5">
              {event && <StatusBadge status={event.status} />}
              <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
                {sourceObj?.name || "Webhook Event"}
              </span>
              {event && (
                <span className="text-xs text-slate-400">
                  · <RelativeTime value={event.receivedAt} />
                </span>
              )}
            </div>
            {event && (
              <div className="flex items-center gap-2">
                <code className="truncate font-mono text-xs text-slate-700 dark:text-slate-300">
                  {event.idempotencyKey}
                </code>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  aria-label="Copy event idempotency key"
                  className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {canReplay && (
              <button
                type="button"
                disabled={replayMutation.isPending}
                onClick={() => replayMutation.mutate()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {replayMutation.isPending ? "Queuing..." : "Replay"}
              </button>
            )}
            <Link
              to={`/events/${eventId}`}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Full view <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close event drawer"
              className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {detailQuery.isLoading && !event ? (
            <LoadingState label="Loading event details..." />
          ) : detailQuery.isError ? (
            <ErrorState
              message={detailQuery.error.message}
              onRetry={() => detailQuery.refetch()}
            />
          ) : event ? (
            <>
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-900/50 sm:grid-cols-3">
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Received</p>
                  <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                    {formatDateTime(event.receivedAt)}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">
                    Processed
                  </p>
                  <p className="mt-1 font-medium text-slate-900 dark:text-slate-100">
                    {event.processedAt
                      ? formatDateTime(event.processedAt)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500 dark:text-slate-400">Schema</p>
                  <p className="mt-1 font-mono font-medium text-slate-900 dark:text-slate-100">
                    {sourceObj?.schemaType || "—"}
                  </p>
                </div>
              </div>

              {event.errors.length > 0 && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-50 p-4 dark:bg-rose-950/20">
                  <h3 className="text-xs font-semibold text-rose-800 dark:text-rose-200">
                    Errors ({event.errors.length})
                  </h3>
                  <ul className="mt-2 space-y-1.5 text-xs text-rose-700 dark:text-rose-100">
                    {event.errors.map((err, i) => (
                      <li key={`${err.field}-${i}`}>
                        <span className="font-mono text-rose-600 dark:text-rose-300">
                          {err.field || "payload"}
                        </span>
                        : {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Retry & Processing Timeline
                </h3>
                <RetryTimeline event={event} />
              </div>

              <JsonCodeBlock
                title="Raw Webhook Payload"
                subtitle="Signed JSON received by ingestion API"
                data={event.payload}
                maxHeightClass="max-h-72"
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
