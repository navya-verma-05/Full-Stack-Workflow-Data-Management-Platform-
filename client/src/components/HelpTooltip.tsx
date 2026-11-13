import { useState } from "react";
import { HelpCircle } from "lucide-react";

interface HelpTooltipProps {
  definition: string;
  term?: string;
}

export function HelpTooltip({ definition, term }: HelpTooltipProps) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex items-center ml-1">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        aria-label={term ? `Help for ${term}` : "Help"}
        className="rounded text-[var(--text-muted)] hover:text-[var(--text-ink)] focus:outline-none transition-colors"
      >
        <HelpCircle className="h-3.5 w-3.5 shrink-0" />
      </button>

      {open && (
        <span
          role="tooltip"
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-52 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-2 text-[11px] leading-tight text-[var(--text-ink)] shadow-md pointer-events-none"
        >
          {term && (
            <strong className="block mb-0.5 font-semibold">{term}:</strong>
          )}
          {definition}
        </span>
      )}
    </span>
  );
}
