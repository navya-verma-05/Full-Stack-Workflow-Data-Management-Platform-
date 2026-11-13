import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
  XCircle,
} from "lucide-react";
import type { WorkflowEvent } from "../types/api";
import { formatDateTime, formatDurationMs } from "../utils/date";
import { RelativeTime } from "./RelativeTime";

interface RetryTimelineProps {
  event: WorkflowEvent;
  baseDelayMs?: number;
}

function parseBackoffMsFromLog(
  message: string,
  attemptNumber: number,
  baseDelayMs: number,
): number | null {
  const match = message.match(/retry scheduled in (\d+)ms/i);
  if (match) {
    return Number(match[1]);
  }
  if (/retry scheduled/i.test(message)) {
    return baseDelayMs * Math.pow(2, Math.max(0, attemptNumber - 1));
  }
  return null;
}

export function RetryTimeline({
  event,
  baseDelayMs = 1000,
}: RetryTimelineProps) {
  let retryAttemptCounter = 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--text-muted)] font-mono">
        <span>
          Attempts:{" "}
          <strong className="text-[var(--text-ink)]">
            {event.attempts} / {event.maxAttempts}
          </strong>
        </span>
        {event.nextRetryAt && (
          <span className="inline-flex items-center gap-1.5 rounded border border-[#FDBA74] bg-[#FFEDD5] px-2 py-0.5 text-[11px] font-medium text-[#C2410C] dark:border-[#52230B] dark:bg-[#361808] dark:text-[#FB923C]">
            <Clock className="h-3 w-3" />
            Next retry <RelativeTime value={event.nextRetryAt} /> (
            {formatDateTime(event.nextRetryAt)})
          </span>
        )}
        {event.deadLetteredAt && (
          <span className="inline-flex items-center gap-1.5 rounded border border-[#FECACA] bg-[#FEE2E2] px-2 py-0.5 text-[11px] font-medium text-[#B91C1C] dark:border-[#541919] dark:bg-[#381111] dark:text-[#F87171]">
            <XCircle className="h-3 w-3" />
            Dead-lettered <RelativeTime value={event.deadLetteredAt} />
          </span>
        )}
      </div>

      {event.processingLogs.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)]">
          No processing logs recorded yet.
        </p>
      ) : (
        <ol className="relative ml-2.5 space-y-3.5 border-l border-[var(--border-hairline)] pl-5">
          {event.processingLogs.map((log, idx) => {
            const isRetry = log.stage === "retry";
            if (isRetry) retryAttemptCounter += 1;
            const backoffMs = isRetry
              ? parseBackoffMsFromLog(
                  log.message,
                  retryAttemptCounter,
                  baseDelayMs,
                )
              : null;

            const iconWrap =
              log.level === "error"
                ? "border-[#FECACA] bg-[#FEE2E2] text-[#B91C1C] dark:border-[#541919] dark:bg-[#381111] dark:text-[#F87171]"
                : log.level === "warn"
                  ? "border-[#FDE68A] bg-[#FEF3C7] text-[#B45309] dark:border-[#4D3310] dark:bg-[#33220A] dark:text-[#FBBF24]"
                  : "border-[#A5D6A7] bg-[#E8F5E9] text-[#2E7D32] dark:border-[#1E4627] dark:bg-[#132E1B] dark:text-[#4ADE80]";

            const StageIcon =
              log.level === "error"
                ? XCircle
                : isRetry
                  ? RefreshCw
                  : log.level === "warn"
                    ? AlertTriangle
                    : CheckCircle2;

            return (
              <li key={`${log.timestamp}-${idx}`} className="relative">
                <span
                  className={`absolute -left-[27px] top-0.5 flex h-4 w-4 items-center justify-center rounded-full border ${iconWrap}`}
                >
                  <StageIcon className="h-2.5 w-2.5" />
                </span>

                <div className="rounded border border-[var(--border-hairline)] bg-[var(--bg-page)] p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--text-ink)]">
                        {log.stage}
                      </span>
                      {backoffMs !== null && (
                        <span className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[var(--text-ink)]">
                          backoff {formatDurationMs(backoffMs)}
                        </span>
                      )}
                    </div>
                    <span className="font-mono text-[10px] text-[var(--text-muted)]">
                      <RelativeTime value={log.timestamp} /> ·{" "}
                      {formatDateTime(log.timestamp)}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--text-ink)] font-mono">
                    {log.message}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
