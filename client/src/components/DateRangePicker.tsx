import { useState } from "react";
import { Calendar } from "lucide-react";
import { formatShortDate, toIsoDay } from "../utils/date";

type PresetId = "all" | "24h" | "7d" | "30d" | "custom";

interface DateRangePickerProps {
  from: string;
  to: string;
  onChange: (next: { from: string; to: string }) => void;
  fromAriaLabel?: string;
  toAriaLabel?: string;
}

function getPresetBounds(preset: Exclude<PresetId, "all" | "custom">) {
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
        className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-700/80 dark:bg-slate-900"
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
              className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                isActive
                  ? "bg-white text-indigo-600 shadow-sm dark:bg-indigo-600 dark:text-white"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              }`}
            >
              {item.id === "custom" && <Calendar className="h-3 w-3" />}
              {item.label}
            </button>
          );
        })}
      </div>

      {(from || to) && activePreset !== "custom" && (
        <span className="text-xs text-slate-600 dark:text-slate-400">
          {from ? formatShortDate(`${from}T00:00:00Z`) : "Start"} —{" "}
          {to ? formatShortDate(`${to}T00:00:00Z`) : "Today"}
        </span>
      )}

      {(customOpen || activePreset === "custom") && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 dark:border-slate-700 dark:bg-slate-900">
          <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            From
            <input
              aria-label={fromAriaLabel}
              type="date"
              value={from}
              onChange={(e) => onChange({ from: e.target.value, to })}
              className="ml-1.5 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            />
          </label>
          <span className="text-xs text-slate-400">→</span>
          <label className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            To
            <input
              aria-label={toAriaLabel}
              type="date"
              value={to}
              onChange={(e) => onChange({ from, to: e.target.value })}
              className="ml-1.5 rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            />
          </label>
          {(from || to) && (
            <span className="hidden text-[11px] text-slate-500 dark:text-slate-400 sm:inline">
              ({from ? formatShortDate(`${from}T00:00:00Z`) : "…"} –{" "}
              {to ? formatShortDate(`${to}T00:00:00Z`) : "…"})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
