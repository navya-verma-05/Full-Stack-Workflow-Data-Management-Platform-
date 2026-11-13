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
import type { WorkflowEvent } from "../types/api";
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

  const navItems = useMemo(
    () => [
      {
        id: "nav-overview",
        label: "Overview",
        to: "/",
        roles: ["admin", "manager", "viewer"],
        icon: BarChart3,
      },
      {
        id: "nav-events",
        label: "Events",
        to: "/events",
        roles: ["admin", "manager", "viewer"],
        icon: Activity,
      },
      {
        id: "nav-records",
        label: "Records",
        to: "/records",
        roles: ["admin", "manager", "viewer"],
        icon: FileCheck2,
      },
      {
        id: "nav-sources",
        label: "Sources",
        to: "/sources",
        roles: ["admin", "manager", "viewer"],
        icon: Webhook,
      },
      {
        id: "nav-users",
        label: "Users",
        to: "/users",
        roles: ["admin"],
        icon: Users,
      },
      {
        id: "nav-audit-logs",
        label: "Audit Log",
        to: "/audit-logs",
        roles: ["admin"],
        icon: ShieldCheck,
      },
    ],
    [],
  );

  const filteredNavItems = useMemo(() => {
    if (!user) return [];
    return navItems.filter((item) => item.roles.includes(user.role));
  }, [navItems, user]);

  const entries = useMemo<PaletteEntry[]>(() => {
    const q = debounced.toLowerCase();
    const result: PaletteEntry[] = [];

    for (const item of filteredNavItems) {
      if (!q || item.label.toLowerCase().includes(q)) {
        result.push({
          id: item.id,
          section: "Pages",
          label: item.label,
          hint: `Jump to ${item.label}`,
          onSelect: () => {
            navigate(item.to);
            onClose();
          },
        });
      }
    }

    if (
      !q ||
      "theme".includes(q) ||
      "mode".includes(q) ||
      "light".includes(q) ||
      "dark".includes(q)
    ) {
      result.push({
        id: "pref-theme",
        section: "Preferences",
        label: `Switch to ${theme === "dark" ? "Light" : "Dark"} theme`,
        hint: `Active: ${theme} theme`,
        onSelect: () => {
          toggleTheme();
          onClose();
        },
      });
    }

    const eventItems = eventsQuery.data?.items || [];
    for (const evt of eventItems) {
      const src =
        typeof evt.sourceId === "object" && evt.sourceId !== null
          ? evt.sourceId.name
          : evt.source?.name || "Webhook";
      result.push({
        id: evt._id,
        section: "Events",
        label: evt.idempotencyKey,
        hint: `${src} · ${evt.status}`,
        onSelect: () => {
          navigate(`/events/${evt._id}`);
          onClose();
        },
      });
    }

    return result;
  }, [
    debounced,
    filteredNavItems,
    theme,
    toggleTheme,
    eventsQuery.data,
    navigate,
    onClose,
  ]);

  useEffect(() => {
    setActiveIndex(0);
  }, [entries.length]);

  const eventItems = eventsQuery.data?.items;
  const eventMap = useMemo(() => {
    const map = new Map<string, WorkflowEvent>();
    for (const evt of eventItems || []) {
      map.set(evt._id, evt);
    }
    return map;
  }, [eventItems]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
      return;
    }
    if (entries.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % entries.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + entries.length) % entries.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const selected = entries[activeIndex];
      if (selected) {
        selected.onSelect();
      }
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-20 backdrop-blur-[1px]"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-full max-w-xl overflow-hidden rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-xl"
      >
        <div className="flex items-center gap-2.5 border-b border-[var(--border-hairline)] px-3.5 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-[#6B6B66] dark:text-[#8E8B82]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Jump to page or search events..."
            aria-label="Command palette search"
            className="flex-1 bg-transparent font-mono text-xs text-[var(--text-ink)] placeholder-[#6B6B66] focus:outline-none dark:placeholder-[#8E8B82]"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close command palette"
            className="rounded border border-[var(--border-hairline)] p-1 text-[var(--text-muted)] hover:bg-[var(--bg-subtle)] hover:text-[var(--text-ink)]"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {debounced.length >= 2 && eventsQuery.isFetching && (
            <p className="px-3 py-2 font-mono text-xs text-[var(--text-muted)]">
              Searching webhook events...
            </p>
          )}

          {entries.length === 0 ? (
            <p className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">
              No matching pages or events found.
            </p>
          ) : (
            <ul role="listbox" className="space-y-0.5">
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
                      className={`flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-xs transition-colors ${
                        isSelected
                          ? "bg-[var(--bg-subtle)] text-[var(--text-ink)] font-semibold"
                          : "text-[var(--text-ink)] hover:bg-[var(--bg-subtle)]"
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Icon className="h-3.5 w-3.5 shrink-0 text-[var(--text-muted)]" />
                        <div className="min-w-0">
                          <p className="truncate font-medium">{entry.label}</p>
                          {entry.hint && (
                            <p className="truncate font-mono text-[10px] text-[var(--text-muted)]">
                              {entry.hint}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {matchedEvent && (
                          <>
                            <StatusBadge status={matchedEvent.status} />
                            <span className="font-mono text-[10px] text-[var(--text-muted)]">
                              <RelativeTime value={matchedEvent.receivedAt} />
                            </span>
                          </>
                        )}
                        <span className="rounded border border-[var(--border-hairline)] bg-[var(--bg-page)] px-1.5 py-0.2 font-mono text-[9px] uppercase text-[var(--text-muted)]">
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

        <div className="flex items-center justify-between border-t border-[var(--border-hairline)] bg-[var(--bg-page)] px-3.5 py-1.5 font-mono text-[10px] text-[var(--text-muted)]">
          <div className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span className="inline-flex items-center gap-1">
              <CornerDownLeft className="h-3 w-3" /> Select
            </span>
          </div>
          <span>ESC to close</span>
        </div>
      </div>
    </div>
  );
}
