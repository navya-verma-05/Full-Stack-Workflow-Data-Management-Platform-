import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  CornerDownLeft,
  FileCheck2,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  Users,
  Webhook,
  X,
} from "lucide-react";
import { api } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { StatusBadge } from "./StatusBadge";
import { RelativeTime } from "./RelativeTime";

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface PaletteEntry {
  id: string;
  section: "Pages" | "Events" | "Preferences";
  label: string;
  hint?: string;
  onSelect: () => void;
}

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebounced("");
      setActiveIndex(0);
      return;
    }
    const timer = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 10);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    const trimmed = query.trim();
    const timer = window.setTimeout(() => setDebounced(trimmed), 160);
    return () => window.clearTimeout(timer);
  }, [query]);

  const eventsQuery = useQuery({
    queryKey: ["command-palette-events", debounced],
    queryFn: () => api.getEvents({ search: debounced, limit: 6 }),
    enabled: open && debounced.length >= 2,
  });

  const navItems = useMemo(() => {
    const base = [
      {
        id: "nav-overview",
        label: "Overview",
        hint: "Operational KPIs & chart",
        to: "/",
        icon: BarChart3,
      },
      {
        id: "nav-events",
        label: "Events",
        hint: "Webhook ingestion stream",
        to: "/events",
        icon: Activity,
      },
      {
        id: "nav-records",
        label: "Records",
        hint: "Normalized client records",
        to: "/records",
        icon: FileCheck2,
      },
      {
        id: "nav-sources",
        label: "Sources",
        hint: "Webhook endpoints & secrets",
        to: "/sources",
        icon: Webhook,
      },
    ];
    if (user?.role === "admin") {
      base.push(
        {
          id: "nav-users",
          label: "Users",
          hint: "Admin: team & roles",
          to: "/users",
          icon: Users,
        },
        {
          id: "nav-audit",
          label: "Audit Log",
          hint: "Admin: security audit trail",
          to: "/audit-logs",
          icon: ShieldCheck,
        },
      );
    }
    return base;
  }, [user?.role]);

  const entries = useMemo<PaletteEntry[]>(() => {
    const lower = query.trim().toLowerCase();
    const pageEntries: PaletteEntry[] = navItems
      .filter(
        (item) =>
          !lower ||
          item.label.toLowerCase().includes(lower) ||
          item.hint.toLowerCase().includes(lower),
      )
      .map((item) => ({
        id: item.id,
        section: "Pages",
        label: item.label,
        hint: item.hint,
        onSelect: () => {
          navigate(item.to);
          onClose();
        },
      }));

    const eventEntries: PaletteEntry[] = (eventsQuery.data?.items || []).map(
      (ev) => {
        const client =
          String(
            ev.payload.fullName ||
              ev.payload.name ||
              (ev.payload.customer as { name?: string } | undefined)?.name ||
              "",
          ) || "Webhook payload";
        return {
          id: `evt-${ev._id}`,
          section: "Events",
          label: ev.idempotencyKey,
          hint: client,
          onSelect: () => {
            navigate(`/events/${ev._id}`);
            onClose();
          },
        };
      },
    );

    const themeEntry: PaletteEntry = {
      id: "pref-theme",
      section: "Preferences",
      label:
        theme === "dark" ? "Switch to Light theme" : "Switch to Dark theme",
      hint: "Saved locally",
      onSelect: () => {
        toggleTheme();
        onClose();
      },
    };

    const prefEntries =
      !lower ||
      themeEntry.label.toLowerCase().includes(lower) ||
      "theme dark light".includes(lower)
        ? [themeEntry]
        : [];

    return [...pageEntries, ...eventEntries, ...prefEntries];
  }, [
    eventsQuery.data?.items,
    navItems,
    navigate,
    onClose,
    query,
    theme,
    toggleTheme,
  ]);

  useEffect(() => {
    setActiveIndex(0);
  }, [entries.length]);

  if (!open) return null;

  const eventMap = new Map(
    (eventsQuery.data?.items || []).map((ev) => [`evt-${ev._id}`, ev]),
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) =>
        entries.length ? (prev + 1) % entries.length : 0,
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) =>
        entries.length ? (prev - 1 + entries.length) % entries.length : 0,
      );
    } else if (e.key === "Enter" && entries[activeIndex]) {
      e.preventDefault();
      entries[activeIndex].onSelect();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 p-4 pt-[12vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <Search className="h-4 w-4 shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to page or search events by key, client, email..."
            aria-label="Command palette search"
            className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none dark:text-white"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close command palette"
            className="rounded-md border border-slate-200 p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {debounced.length >= 2 && eventsQuery.isFetching && (
            <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">
              Searching webhook events...
            </p>
          )}

          {entries.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-slate-500 dark:text-slate-400">
              No matching pages or events found.
            </p>
          ) : (
            <ul role="listbox" className="space-y-1">
              {entries.map((entry, idx) => {
                const isSelected = idx === activeIndex;
                const matchedEvent = eventMap.get(entry.id);
                const navMeta = navItems.find((n) => n.id === entry.id);
                const Icon =
                  navMeta?.icon ||
                  (entry.id === "pref-theme"
                    ? theme === "dark"
                      ? Sun
                      : Moon
                    : Activity);

                return (
                  <li key={entry.id}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={entry.onSelect}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "bg-indigo-50 text-indigo-900 dark:bg-indigo-600/20 dark:text-white"
                          : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800/70"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                        <div className="min-w-0">
                          <p className="truncate text-xs font-medium">
                            {entry.label}
                          </p>
                          {entry.hint && (
                            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                              {entry.hint}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {matchedEvent && (
                          <>
                            <StatusBadge status={matchedEvent.status} />
                            <span className="text-[11px] text-slate-400">
                              <RelativeTime value={matchedEvent.receivedAt} />
                            </span>
                          </>
                        )}
                        <span className="rounded bg-slate-200/70 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                          {entry.section}
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-950/60 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span className="inline-flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" /> Open
            </span>
          </div>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
}
