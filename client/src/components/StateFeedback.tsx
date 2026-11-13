import { AlertTriangle, Inbox } from "lucide-react";
import type { PaginationMeta } from "../types/api";

export function SkeletonBlock({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[#E4E1DA]/60 dark:bg-[#2B2A27]/60 ${className}`}
    />
  );
}

export function SkeletonTable({
  rows = 6,
  cols = 5,
  label = "Loading data...",
}: {
  rows?: number;
  cols?: number;
  label?: string;
}) {
  return (
    <div
      role="status"
      aria-label={label}
      className="overflow-hidden rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)]"
    >
      <div className="border-b border-[var(--border-hairline)] bg-[var(--bg-page)] px-4 py-2.5">
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((_, idx) => (
            <SkeletonBlock key={idx} className="h-3 w-20" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-[var(--border-hairline)] p-4">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid gap-4 py-2.5"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: cols }).map((__, c) => (
              <SkeletonBlock
                key={c}
                className={c === 0 ? "h-3.5 w-3/4" : "h-3.5 w-1/2"}
              />
            ))}
          </div>
        ))}
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function SkeletonOverview({
  label = "Loading overview metrics...",
}: {
  label?: string;
}) {
  return (
    <div role="status" aria-label={label} className="space-y-6">
      <div className="grid grid-cols-1 divide-y border border-[var(--border-hairline)] bg-[var(--bg-surface)] rounded sm:grid-cols-2 sm:divide-y-0 sm:divide-x lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="p-4 sm:p-5">
            <SkeletonBlock className="h-3 w-24" />
            <SkeletonBlock className="mt-2 h-7 w-20" />
            <SkeletonBlock className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5">
        <SkeletonBlock className="h-4 w-48" />
        <SkeletonBlock className="mt-4 h-64 w-full" />
      </div>
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function LoadingState({ label = "Loading..." }: { label?: string }) {
  return (
    <div
      role="status"
      aria-label={label}
      className="space-y-3 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-5"
    >
      <SkeletonBlock className="h-4 w-1/3" />
      <SkeletonBlock className="h-4 w-2/3" />
      <SkeletonBlock className="h-20 w-full" />
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
    <div className="flex flex-col items-center justify-center rounded border border-dashed border-[var(--border-hairline)] bg-[var(--bg-surface)] px-6 py-12 text-center">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full border border-[var(--border-hairline)] bg-[var(--bg-page)] text-[var(--text-muted)]">
        <Inbox className="h-5 w-5" />
      </div>
      <p className="text-sm font-semibold text-[var(--text-ink)]">{title}</p>
      <p className="mt-1 max-w-md text-xs text-[var(--text-muted)]">
        {description}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] transition-colors"
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
      className="flex flex-wrap items-center justify-between gap-4 rounded border border-[#FECACA] bg-[#FEE2E2] p-4 text-xs font-medium text-[#B91C1C] dark:border-[#541919] dark:bg-[#381111] dark:text-[#F87171]"
    >
      <div className="flex items-center gap-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        <p>{message}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="rounded border border-[#FECACA] bg-[var(--bg-surface)] px-2.5 py-1 text-xs font-semibold text-[#B91C1C] hover:bg-[#FEE2E2] dark:border-[#541919] dark:text-[#F87171] dark:hover:bg-[#381111]"
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border-hairline)] px-4 py-2.5 text-xs text-[var(--text-muted)] font-mono">
      <span>
        Showing <strong className="text-[var(--text-ink)]">{start}</strong>–
        <strong className="text-[var(--text-ink)]">{end}</strong> of{" "}
        <strong className="text-[var(--text-ink)]">{total}</strong>
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] disabled:opacity-40"
        >
          Previous
        </button>
        <span className="tabular-nums text-[var(--text-ink)]">
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1 text-xs text-[var(--text-ink)] hover:bg-[var(--bg-subtle)] disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
