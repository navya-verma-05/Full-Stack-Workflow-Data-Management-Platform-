import { AlertCircle, Inbox, Loader2 } from 'lucide-react';
import type { PaginationMeta } from '../types/api';

export function LoadingState({ label = 'Loading data...' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 py-14 text-slate-400"
    >
      <Loader2 className="mb-3 h-7 w-7 animate-spin text-indigo-400" />
      <p className="text-sm">{label}</p>
    </div>
  );
}

export function EmptyState({
  title = 'No matching results',
  description = 'Try adjusting your filters or date range.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-800 bg-slate-900/40 py-14 text-center">
      <Inbox className="mb-3 h-8 w-8 text-slate-500" />
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="mt-1 text-xs text-slate-400">{description}</p>
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
      className="flex flex-col items-center justify-center rounded-xl border border-rose-500/30 bg-rose-950/20 px-6 py-10 text-center"
    >
      <AlertCircle className="mb-2 h-7 w-7 text-rose-400" />
      <p className="text-sm font-medium text-rose-200">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-200 hover:bg-rose-500/20"
        >
          Retry
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
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 px-4 py-3 text-xs text-slate-400">
      <span>
        Showing <strong className="text-slate-200">{start}</strong>–
        <strong className="text-slate-200">{end}</strong> of{' '}
        <strong className="text-slate-200">{total}</strong>
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 font-medium text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="px-2 text-slate-300">
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-1.5 font-medium text-slate-200 hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}

