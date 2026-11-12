import { AlertTriangle, Inbox } from 'lucide-react';
import type { PaginationMeta } from '../types/api';

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-md bg-slate-200/80 dark:bg-slate-800/80 ${className}`}
    />
  );
}

export function SkeletonTable({
  rows = 6,
  cols = 5,
  label = 'Loading data...',
}: {
  rows?: number;
  cols?: number;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60"
    >
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/90">
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
          {Array.from({ length: cols }).map((_, idx) => (
            <SkeletonBlock key={idx} className="h-3 w-20" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-100 p-4 dark:divide-slate-800/80">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid gap-4 py-3"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }).map((__, c) => (
              <SkeletonBlock key={c} className={c === 0 ? 'h-4 w-3/4' : 'h-4 w-1/2'} />
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function SkeletonOverview({ label = 'Loading overview metrics...' }: { label?: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, idx) => (
          <div
            key={idx}
            className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900/60"
          >
            <SkeletonBlock className="h-3 w-20" />
            <SkeletonBlock className="mt-3 h-7 w-16" />
            <SkeletonBlock className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60 lg:col-span-2">
          <SkeletonBlock className="h-4 w-48" />
          <SkeletonBlock className="mt-4 h-64 w-full rounded-lg" />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60">
          <SkeletonBlock className="h-4 w-36" />
          <div className="mt-4 space-y-3">
            {Array.from({ length: 4 }).map((_, idx) => (
              <SkeletonBlock key={idx} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        </div>
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="space-y-3 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60"
    >
      <SkeletonBlock className="h-4 w-1/3" />
      <SkeletonBlock className="h-4 w-2/3" />
      <SkeletonBlock className="h-24 w-full" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center dark:border-slate-800 dark:bg-slate-900/40">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-400 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400">
        <Inbox className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">{title}</p>
      <p className="mt-1 max-w-md text-xs text-slate-500 dark:text-slate-400">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-rose-500/30 bg-rose-50 p-4 text-rose-800 dark:bg-rose-950/30 dark:text-rose-200"
    >
      <div className="flex items-center gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-rose-500 dark:text-rose-400" />
        <p className="text-sm">{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-lg border border-rose-500/40 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 dark:bg-rose-900/40 dark:text-rose-100 dark:hover:bg-rose-900/60"
        >
          Try again
        </button>
      )}
    </div>
  );
}

export function PaginationControls({
  pagination,
  onPageChange,
}: {
  pagination: PaginationMeta;
  onPageChange: (nextPage: number) => void;
}) {
  const { page, totalPages, total, limit } = pagination;
  const start = total === 0 ? 0 : (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-xs text-slate-600 dark:border-slate-800 dark:text-slate-400">
      <span>
        Showing <strong className="font-medium text-slate-900 dark:text-slate-200">{start}</strong>–
        <strong className="font-medium text-slate-900 dark:text-slate-200">{end}</strong> of{' '}
        <strong className="font-medium text-slate-900 dark:text-slate-200">{total}</strong>
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Previous
        </button>
        <span className="tabular-nums text-slate-700 dark:text-slate-300">
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Next
        </button>
      </div>
    </div>
  );
}
