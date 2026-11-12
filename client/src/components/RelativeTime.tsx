import { formatDateTime, formatRelativeTime } from '../utils/date';

interface RelativeTimeProps {
  value: string | Date | null | undefined;
  fallback?: string;
  className?: string;
}

export function RelativeTime({ value, fallback = 'Never', className = '' }: RelativeTimeProps) {
  if (!value) {
    return <span className={className}>{fallback}</span>;
  }

  const exact = formatDateTime(value);
  const relative = formatRelativeTime(value);
  const iso = typeof value === 'string' ? value : value.toISOString();

  return (
    <time
      dateTime={iso}
      title={exact}
      className={`cursor-help border-b border-dotted border-slate-400/50 dark:border-slate-600 ${className}`}
    >
      {relative}
    </time>
  );
}

