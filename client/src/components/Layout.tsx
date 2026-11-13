import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity,
  BarChart3,
  Database,
  FileCheck2,
  LogOut,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
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

export function Layout() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
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

  const renderNavLinks = (collapsed = false, onNavigate?: () => void) => (
    <nav className="space-y-1" aria-label="Primary navigation">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={collapsed ? item.label : undefined}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center ${collapsed ? "justify-center px-2" : "gap-3 px-3"} rounded-lg py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border border-indigo-500/30 bg-indigo-50 text-indigo-700 dark:bg-indigo-600/20 dark:text-indigo-300"
                  : "border border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800/70 dark:hover:text-white"
              }`
            }
          >
            <Icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 lg:flex">
      {/* Desktop sidebar */}
      <aside
        className={`hidden shrink-0 flex-col border-r border-slate-200 bg-white p-3.5 transition-all duration-200 dark:border-slate-800 dark:bg-slate-900/70 lg:flex ${
          sidebarCollapsed ? "w-[72px]" : "w-64"
        }`}
      >
        <div
          className={`mb-6 flex items-center ${
            sidebarCollapsed ? "justify-center" : "justify-between px-1.5"
          }`}
        >
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
              <Database className="h-5 w-5" />
            </div>
            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
                  Workflow Platform
                </p>
                <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                  Ingestion & Telemetry
                </p>
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <button
              type="button"
              onClick={() => setSidebarCollapsed(true)}
              aria-label="Collapse sidebar"
              title="Collapse sidebar"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {sidebarCollapsed && (
          <button
            type="button"
            onClick={() => setSidebarCollapsed(false)}
            aria-label="Expand sidebar"
            title="Expand sidebar"
            className="mb-3 flex items-center justify-center rounded-lg border border-slate-200 py-1.5 text-slate-500 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <PanelLeftOpen className="h-4 w-4" />
          </button>
        )}

        <div className="flex-1">{renderNavLinks(sidebarCollapsed)}</div>

        {user && (
          <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-800">
            {!sidebarCollapsed && (
              <div className="mb-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800/80 dark:bg-slate-950/70">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                    {user.name}
                  </p>
                  <RoleBadge role={user.role} />
                </div>
                <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">
                  {user.email}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={handleLogout}
              title={sidebarCollapsed ? "Sign out" : undefined}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <LogOut className="h-3.5 w-3.5 shrink-0" />
              {!sidebarCollapsed && <span>Sign out</span>}
            </button>
          </div>
        )}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar (desktop & mobile) */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/90 px-4 py-2.5 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label="Toggle navigation"
              onClick={() => setMobileOpen((prev) => !prev)}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 dark:border-slate-700 dark:text-slate-300 lg:hidden"
            >
              {mobileOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {pageTitle}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              aria-label="Open command palette"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500 transition-colors hover:border-slate-300 hover:bg-white hover:text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200"
            >
              <Search className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Search events or jump...</span>
              <kbd className="hidden rounded border border-slate-300 bg-white px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 md:inline">
                Ctrl+K
              </kbd>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 transition-colors hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {theme === "dark" ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </button>
          </div>
        </header>

        {/* Mobile slide-down nav */}
        {mobileOpen && (
          <div className="border-b border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:hidden">
            {renderNavLinks(false, () => setMobileOpen(false))}
            {user && (
              <div className="mt-4 flex items-center justify-between border-t border-slate-200 pt-3 dark:border-slate-800">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-600 dark:text-slate-300">
                    {user.email}
                  </span>
                  <RoleBadge role={user.role} />
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-700 dark:border-slate-700 dark:text-slate-200"
                >
                  Sign out
                </button>
              </div>
            )}
          </div>
        )}

        <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}
