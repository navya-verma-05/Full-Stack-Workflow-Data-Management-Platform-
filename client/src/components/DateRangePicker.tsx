import { useState } from "react";
import { Calendar } from "lucide-react";
import { formatShortDate, toIsoDay } from "../utils/date";

export type PresetId = "all" | "24h" | "7d" | "30d" | "custom";

interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  fromAriaLabel?: string;
  toAriaLabel?: string;
}

export function getPresetBounds(preset: Exclude<PresetId, "all" | "custom">) {
  const today = new Date();
  const days = preset === "24h" ? 1 : preset === "7d" ? 6 : 29;
  const start = new Date(today.getTime() - days * 86_400_000);
  return {
    from: toIsoDay(start),
    to: toIsoDay(today),
  };
}

function detectActivePreset(
  from: string,
  to: string,
  customOpen: boolean,
): PresetId {
  if (customOpen) return "custom";
  if (!from && !to) return "all";
  for (const id of ["24h", "7d", "30d"] as const) {
    const bounds = getPresetBounds(id);
    if (bounds.from === from && bounds.to === to) return id;
  }
  return "custom";
}

export function DateRangePicker({
  from,
  to,
  onChange,
  fromAriaLabel = "From date",
  toAriaLabel = "To date",
}: DateRangePickerProps) {
  const [customOpen, setCustomOpen] = useState(false);
  const activePreset = detectActivePreset(from, to, customOpen);

  const handleSelectPreset = (preset: PresetId) => {
    if (preset === "all") {
      setCustomOpen(false);
      onChange({ from: "", to: "" });
      return;
    }
    if (preset === "custom") {
      setCustomOpen((prev) => !prev);
      return;
    }
    setCustomOpen(false);
    onChange(getPresetBounds(preset));
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        role="group"
        aria-label="Date range presets"
        className="inline-flex items-center rounded border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-0.5"
      >
        {(
          [
            { id: "all", label: "All time" },
            { id: "24h", label: "24h" },
            { id: "7d", label: "7d" },
            { id: "30d", label: "30d" },
            { id: "custom", label: "Custom" },
          ] as const
        ).map((item) => {
          const isActive = activePreset === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectPreset(item.id)}
              className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-[var(--bg-surface)] text-[var(--text-ink)] font-semibold border border-[var(--border-hairline)]"
                  : "border border-transparent text-[var(--text-muted)] hover:text-[var(--text-ink)]"
              }`}
            >
              {item.id === "custom" && <Calendar className="h-3 w-3" />}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {(from || to) && activePreset !== "custom" && (
        <span className="font-mono text-xs text-[var(--text-muted)]">
          {from ? formatShortDate(`${from}T00:00:00Z`) : "Start"} —{" "}
          {to ? formatShortDate(`${to}T00:00:00Z`) : "Today"}
        </span>
      )}

      {(customOpen || activePreset === "custom") && (
        <div className="flex flex-wrap items-center gap-2 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-2.5 py-1.5">
          <label className="text-[11px] font-medium text-[var(--text-muted)]">
            From
            <input
              aria-label={fromAriaLabel}
              type="date"
              value={from}
              onChange={(e) => onChange({ from: e.target.value, to })}
              className="ml-1.5 rounded border border-[var(--border-hairline)] bg-[var(--bg-page)] px-2 py-0.5 font-mono text-xs text-[var(--text-ink)]"
            />
          </label>
          <span className="text-xs text-[var(--text-muted)]">→</span>
          <label className="text-[11px] font-medium text-[var(--text-muted)]">
            To
            <input
              aria-label={toAriaLabel}
              type="date"
              value={to}
              onChange={(e) => onChange({ from, to: e.target.value })}
              className="ml-1.5 rounded border border-[var(--border-hairline)] bg-[var(--bg-page)] px-2 py-0.5 font-mono text-xs text-[var(--text-ink)]"
            />
          </label>
          {(from || to) && (
            <span className="hidden font-mono text-[11px] text-[var(--text-muted)] sm:inline">
              ({from ? formatShortDate(`${from}T00:00:00Z`) : "…"} –{" "}
              {to ? formatShortDate(`${to}T00:00:00Z`) : "…"})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
