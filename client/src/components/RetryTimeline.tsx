import { AlertTriangle, CheckCircle2, Clock, RefreshCw, XCircle } from 'lucide-react';
import type { WorkflowEvent } from '../types/api';
import { formatDateTime, formatDurationMs } from '../utils/date';
import { RelativeTime } from './RelativeTime';

interface RetryTimelineProps {
  event: WorkflowEvent;
  baseDelayMs?: number;
}

function parseBackoffMsFromLog(message: string, attemptNumber: number, baseDelayMs: number): number | null {
  const match = message.match(/retry scheduled in (\d+)ms/i);
  if (match) {
    return Number(match[1]);
  }
  if (/retry scheduled/i.test(message)) {
    return baseDelayMs * Math.pow(2, Math.max(0, attemptNumber - 1));
  }
  return null;
}

export function RetryTimeline({ event, baseDelayMs = 1000 }: RetryTimelineProps) {
  let retryAttemptCounter = 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
        <span>
          Attempts:{' '}
          <strong className="font-semibold text-slate-900 dark:text-white">
            {event.attempts} / {event.maxAttempts}
          </strong>
        </span>
        {event.nextRetryAt && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-0.5 text-[11px] font-medium text-orange-700 dark:text-orange-300">
            <Clock className="h-3 w-3" />
            Next retry <RelativeTime value={event.nextRetryAt} /> ({formatDateTime(event.nextRetryAt)})
          </span>
        )}
        {event.deadLetteredAt && (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-medium text-rose-700 dark:text-rose-300">
            <XCircle className="h-3 w-3" />
            Dead-lettered <RelativeTime value={event.deadLetteredAt} />
          </span>
        )}
      </div>

      {event.processingLogs.length === 0 ? (
        <p className="text-xs text-slate-500 dark:text-slate-400">No processing logs recorded yet.</p>
      ) : (
        <ol className="relative ml-2.5 space-y-4 border-l border-slate-200 pl-5 dark:border-slate-800">
          {event.processingLogs.map((log, idx) => {
            const isRetry = log.stage === 'retry';
            if (isRetry) retryAttemptCounter += 1;
            const backoffMs = isRetry
              ? parseBackoffMsFromLog(log.message, retryAttemptCounter, baseDelayMs)
              : null;

            const iconWrap =
              log.level === 'error'
                ? 'border-rose-500/40 bg-rose-50 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                : log.level === 'warn'
                  ? 'border-amber-500/40 bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400'
                  : 'border-emerald-500/40 bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400';

            const StageIcon =
              log.level === 'error'
                ? XCircle
                : isRetry
                  ? RefreshCw
                  : log.level === 'warn'
                    ? AlertTriangle
                    : CheckCircle2;

            return (
              <li key={`${log.timestamp}-${idx}`} className="relative">
                <span
                  className={`absolute -left-[29px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${iconWrap}`}
                >
                  <StageIcon className="h-3 w-3" />
                </span>

                <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800/80 dark:bg-slate-950/60">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {log.stage}
                      </span>
                      {backoffMs !== null && (
                        <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 font-mono text-[10px] font-medium text-indigo-700 dark:text-indigo-300">
                          backoff {formatDurationMs(backoffMs)}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      <RelativeTime value={log.timestamp} /> · {formatDateTime(log.timestamp)}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs text-slate-700 dark:text-slate-300">{log.message}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
