const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const shortDateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

const chartDayFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  timeZone: "UTC",
});

export function formatDateTime(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dateTimeFormatter.format(date);
}

export function formatShortDate(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return shortDateFormatter.format(date);
}

export function formatBucketLabel(
  bucket: string,
  granularity: "day" | "hour" = "day",
): string {
  if (granularity === "hour") {
    const parsed = new Date(bucket);
    if (!Number.isNaN(parsed.getTime())) {
      return `${chartDayFormatter.format(parsed)} ${String(parsed.getUTCHours()).padStart(2, "0")}:00`;
    }
    return bucket;
  }
  const parsed = new Date(`${bucket}T00:00:00Z`);
  if (!Number.isNaN(parsed.getTime())) {
    return chartDayFormatter.format(parsed);
  }
  return bucket;
}

export function formatRelativeTime(
  value: string | Date | null | undefined,
): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  const ts = date.getTime();
  if (Number.isNaN(ts)) return "—";

  const diffSec = Math.round((Date.now() - ts) / 1000);
  if (diffSec < 0) {
    const aheadMin = Math.round(Math.abs(diffSec) / 60);
    if (aheadMin < 60) {
      return `in ${aheadMin}m`;
    }
    const aheadHours = Math.round(aheadMin / 60);
    return `in ~${aheadHours}h`;
  }
  if (diffSec < 45) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const days = Math.floor(diffSec / 86400);
  if (days <= 30) return `${days}d ago`;
  return formatShortDate(date);
}

export function toIsoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function formatDurationMs(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)} s`;
  return `${Math.round(ms / 60_000)} m`;
}
