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
  event: WorkflowEvent | null;
  onClose: () => void;
}

export function EventDrawer({
  event: initialEvent,
  onClose,
}: EventDrawerProps) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();

  const eventId = initialEvent?._id || null;

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
      className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-full w-full max-w-2xl flex-col border-l border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border-hairline)] px-6 py-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              {event && <StatusBadge status={event.status} />}
              <span className="text-xs font-semibold text-[var(--text-ink)]">
                {sourceObj?.name || "Webhook Event"}
              </span>
              {event && (
                <span className="font-mono text-xs text-[var(--text-muted)]">
                  · <RelativeTime value={event.receivedAt} />
                </span>
              )}
            </div>
            {event && (
              <div className="flex items-center gap-1.5">
                <code className="truncate font-mono text-xs text-[var(--text-ink)]">
                  {event.idempotencyKey}
                </code>
                <button
                  type="button"
                  onClick={handleCopyKey}
                  aria-label="Copy event idempotency key"
                  className="rounded p-1 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-ink)]"
                >
                  <Copy className="h-3 w-3" />
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
                className="inline-flex items-center gap-1.5 rounded bg-[#1B1B1A] px-2.5 py-1 text-xs font-medium text-[#F6F4EF] hover:bg-[#2E2E2C] dark:bg-[#ECE9E2] dark:text-[#141413] dark:hover:bg-[#FFFFFF] transition-colors disabled:opacity-50"
              >
                <RotateCcw className="h-3 w-3" />
                <span>
                  {replayMutation.isPending ? "Queuing..." : "Replay"}
                </span>
              </button>
            )}
            <Link
              to={`/events/${eventId}`}
              className="inline-flex items-center gap-1 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-medium text-[var(--text-ink)] hover:bg-[var(--bg-subtle)]"
            >
              <span>Full view</span>
              <ArrowUpRight className="h-3 w-3" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close event drawer"
              className="rounded border border-[var(--border-hairline)] p-1 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-ink)]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-6">
          {detailQuery.isLoading && !event ? (
            <LoadingState label="Loading event details..." />
          ) : detailQuery.isError ? (
            <ErrorState
              message={detailQuery.error.message}
              onRetry={() => detailQuery.refetch()}
            />
          ) : event ? (
            <>
              <div className="grid grid-cols-2 gap-3 rounded border border-[var(--border-hairline)] bg-[var(--bg-page)] p-3.5 text-xs sm:grid-cols-3">
                <div>
                  <p className="font-mono text-[10px] uppercase text-[var(--text-muted)]">
                    Received
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-semibold text-[var(--text-ink)]">
                    {formatDateTime(event.receivedAt)}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase text-[var(--text-muted)]">
                    Processed
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-semibold text-[var(--text-ink)]">
                    {event.processedAt
                      ? formatDateTime(event.processedAt)
                      : "—"}
                  </p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase text-[var(--text-muted)]">
                    Schema
                  </p>
                  <p className="mt-0.5 font-mono text-xs font-semibold text-[var(--text-ink)]">
                    {sourceObj?.schemaType || "—"}
                  </p>
                </div>
              </div>

              {event.errors && event.errors.length > 0 && (
                <div className="rounded border border-[#FECACA] bg-[#FEE2E2] p-3.5 text-xs dark:border-[#541919] dark:bg-[#381111]">
                  <h3 className="font-semibold text-[#B91C1C] dark:text-[#F87171]">
                    Validation Errors ({event.errors.length})
                  </h3>
                  <ul className="mt-1.5 space-y-1 text-[#B91C1C] dark:text-[#F87171]">
                    {event.errors.map((err, i) => (
                      <li key={`${err.field}-${i}`}>
                        <span className="font-mono font-semibold">
                          {err.field || "payload"}
                        </span>
                        : {err.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div>
                <h3 className="mb-2.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-muted)]">
                  Retry & Processing Timeline
                </h3>
                <RetryTimeline event={event} />
              </div>

              <JsonCodeBlock
                title="Raw Webhook Payload"
                subtitle="Signed JSON envelope stored on ingestion"
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
