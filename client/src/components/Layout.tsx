import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  FileCheck2,
  LogOut,
  Menu,
  Moon,
  Search,
  ShieldCheck,
  Sun,
  Users,
  Webhook,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useToast } from "../context/ToastContext";
import { CommandPalette } from "./CommandPalette";
import { RoleBadge } from "./StatusBadge";

function getPageTitle(pathname: string): string {
  if (pathname === "/") return "Overview";
  if (pathname.startsWith("/events/")) return "Event Detail";
  if (pathname.startsWith("/events")) return "Events";
  if (pathname.startsWith("/records")) return "Records";
  if (pathname.startsWith("/sources")) return "Sources";
  if (pathname.startsWith("/users")) return "Users";
  if (pathname.startsWith("/audit-logs")) return "Audit Log";
  return "Dashboard";
}

function PipelineLogoMark({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 6h6a3 3 0 0 1 3 3v6a3 3 0 0 0 3 3h4" />
      <circle cx="4" cy="6" r="2" fill="currentColor" />
      <circle cx="20" cy="18" r="2" fill="currentColor" />
      <path d="M4 18h4a3 3 0 0 0 3-3V9a3 3 0 0 1 3-3h6" />
    </svg>
  );
}

export function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const pageTitle = getPageTitle(location.pathname);

  useEffect(() => {
    document.title = `${pageTitle} · Workflow Platform`;
  }, [pageTitle]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const navItems = [
    { to: "/", label: "Overview", icon: BarChart3, end: true },
    { to: "/events", label: "Events", icon: Activity },
    { to: "/records", label: "Records", icon: FileCheck2 },
    { to: "/sources", label: "Sources", icon: Webhook },
    ...(user?.role === "admin"
      ? [
          { to: "/users", label: "Users", icon: Users },
          { to: "/audit-logs", label: "Audit Log", icon: ShieldCheck },
        ]
      : []),
  ];

  const handleLogout = async () => {
    await logout();
    toast.info("Signed out");
    navigate("/login", { replace: true });
  };

  const renderNavLinks = (onNavigate?: () => void) => (
    <nav className="space-y-0.5" aria-label="Primary navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `group flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors border-l-2 ${
                isActive
                  ? "border-[#1B1B1A] bg-[#ECE9E2] text-[#1B1B1A] font-semibold dark:border-[#ECE9E2] dark:bg-[#262522] dark:text-[#ECE9E2]"
                  : "border-transparent text-[#6B6B66] hover:bg-[#EFECE6] hover:text-[#1B1B1A] dark:text-[#8E8B82] dark:hover:bg-[#201F1D] dark:hover:text-[#ECE9E2]"
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-105" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-[var(--bg-page)] text-[var(--text-ink)] antialiased">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 h-screen border-r border-[var(--border-hairline)] bg-[var(--bg-surface)] shrink-0 select-none">
        {/* Brand Header */}
        <div className="flex h-14 items-center justify-between border-b border-[var(--border-hairline)] px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <PipelineLogoMark className="h-5 w-5 text-[#1B1B1A] dark:text-[#ECE9E2] shrink-0" />
            <div className="min-w-0">
              <span className="block truncate text-xs font-bold tracking-tight text-[#1B1B1A] dark:text-[#ECE9E2] uppercase">
                Workflow Platform
              </span>
              <span className="block truncate font-mono text-[10px] text-[#6B6B66] dark:text-[#8E8B82]">
                Pipeline v1.0
              </span>
            </div>
          </div>
        </div>

        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <div className="px-3 pb-2 pt-1">
            <span className="font-mono text-[10px] uppercase tracking-wider text-[#6B6B66] dark:text-[#8E8B82]">
              Navigation
            </span>
          </div>
          {renderNavLinks()}
        </div>

        {/* Bottom Pinned User Card & Sign Out */}
        {user && (
          <div className="mt-auto border-t border-[var(--border-hairline)] bg-[var(--bg-surface)] p-3 space-y-2.5">
            <div className="rounded border border-[var(--border-hairline)] bg-[var(--bg-subtle)] p-2.5">
              <div className="flex items-center justify-between gap-1.5">
                <p className="truncate text-xs font-semibold text-[#1B1B1A] dark:text-[#ECE9E2]">
                  {user.name}
                </p>
                <RoleBadge role={user.role} />
              </div>
              <p className="mt-0.5 truncate font-mono text-[11px] text-[#6B6B66] dark:text-[#8E8B82]">
                {user.email}
              </p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-1.5 rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-3 py-1.5 text-xs font-medium text-[#1B1B1A] hover:bg-[var(--bg-subtle)] dark:text-[#ECE9E2] transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign out</span>
            </button>
          </div>
        )}
      </aside>

      {/* Mobile Off-Canvas Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 transition-opacity"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />

          {/* Off-canvas panel */}
          <div className="fixed inset-y-0 left-0 flex w-72 flex-col border-r border-[var(--border-hairline)] bg-[var(--bg-surface)] shadow-xl z-50">
            <div className="flex h-14 items-center justify-between border-b border-[var(--border-hairline)] px-4">
              <div className="flex items-center gap-2">
                <PipelineLogoMark className="h-5 w-5 text-[#1B1B1A] dark:text-[#ECE9E2]" />
                <span className="text-xs font-bold uppercase tracking-tight text-[#1B1B1A] dark:text-[#ECE9E2]">
                  Workflow Platform
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation"
                className="rounded p-1 text-[#6B6B66] hover:bg-[var(--bg-subtle)] hover:text-[#1B1B1A] dark:text-[#8E8B82]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-3">
              {renderNavLinks(() => setMobileOpen(false))}
            </div>

            {user && (
              <div className="mt-auto border-t border-[var(--border-hairline)] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-[#1B1B1A] dark:text-[#ECE9E2]">
                      {user.name}
                    </p>
                    <p className="font-mono text-[11px] text-[#6B6B66] dark:text-[#8E8B82]">
                      {user.email}
                    </p>
                  </div>
                  <RoleBadge role={user.role} />
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center justify-center gap-1.5 rounded border border-[var(--border-hairline)] py-1.5 text-xs font-medium text-[#1B1B1A] dark:text-[#ECE9E2] hover:bg-[var(--bg-subtle)]"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Sign out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Independent Scrollable Viewport */}
      <div className="flex flex-1 flex-col min-w-0 h-screen overflow-hidden">
        {/* Sticky Top Bar */}
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-[var(--border-hairline)] bg-[var(--bg-surface)] px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              aria-label="Toggle navigation"
              onClick={() => setMobileOpen(true)}
              className="rounded border border-[var(--border-hairline)] p-1.5 text-[#6B6B66] hover:text-[#1B1B1A] hover:bg-[var(--bg-subtle)] dark:text-[#8E8B82] lg:hidden"
            >
              <Menu className="h-4 w-4" />
            </button>
            <h1 className="text-sm font-semibold tracking-tight text-[#1B1B1A] dark:text-[#ECE9E2]">
              {pageTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
              className="inline-flex items-center gap-2 rounded border border-[var(--border-hairline)] bg-[var(--bg-page)] px-2.5 py-1 text-xs text-[#6B6B66] transition-colors hover:border-[#1B1B1A] hover:text-[#1B1B1A] dark:text-[#8E8B82] dark:hover:border-[#ECE9E2] dark:hover:text-[#ECE9E2]"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search...</span>
              <kbd className="hidden rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] px-1.5 py-0.5 font-mono text-[10px] text-[#6B6B66] dark:text-[#8E8B82] md:inline">
                Ctrl+K
              </kbd>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              className="rounded border border-[var(--border-hairline)] bg-[var(--bg-surface)] p-1.5 text-[#6B6B66] transition-colors hover:bg-[var(--bg-subtle)] hover:text-[#1B1B1A] dark:text-[#8E8B82] dark:hover:text-[#ECE9E2]"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
        </header>

        {/* Independently Scrollable Page Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[var(--bg-page)]">
          <div className="mx-auto max-w-7xl">
            <Outlet />
          </div>
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}
