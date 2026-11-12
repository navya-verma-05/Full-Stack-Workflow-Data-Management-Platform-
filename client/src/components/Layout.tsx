import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Database,
  FileCheck2,
  LogOut,
  Menu,
  ShieldCheck,
  Users,
  Webhook,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { RoleBadge } from './StatusBadge';

export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { to: '/', label: 'Overview', icon: BarChart3, end: true },
    { to: '/events', label: 'Events', icon: Activity },
    { to: '/records', label: 'Records', icon: FileCheck2 },
    { to: '/sources', label: 'Sources', icon: Webhook },
    ...(user?.role === 'admin'
      ? [
          { to: '/users', label: 'Users', icon: Users },
          { to: '/audit-logs', label: 'Audit Log', icon: ShieldCheck },
        ]
      : []),
  ];

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const renderNavLinks = (onNavigate?: () => void) => (
    <nav className="space-y-1">
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30'
                  : 'text-slate-300 hover:bg-slate-800/70 hover:text-white border border-transparent'
              }`
            }
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 lg:flex">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900/70 p-4 lg:flex">
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Workflow Platform</p>
            <p className="text-xs text-slate-400">Ingestion & Telemetry</p>
          </div>
        </div>

        <div className="flex-1">{renderNavLinks()}</div>

        {user && (
          <div className="mt-6 border-t border-slate-800 pt-4">
            <div className="mb-3 rounded-lg bg-slate-950/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-slate-100">{user.name}</p>
                <RoleBadge role={user.role} />
              </div>
              <p className="mt-1 truncate text-xs text-slate-400">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        )}
      </aside>

      {/* Mobile header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/90 px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-indigo-400" />
          <span className="text-sm font-semibold">Workflow Platform</span>
        </div>
        <button
          type="button"
          aria-label="Toggle navigation"
          onClick={() => setMobileOpen((prev) => !prev)}
          className="rounded-lg border border-slate-700 p-1.5 text-slate-300"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-b border-slate-800 bg-slate-900 p-4 lg:hidden">
          {renderNavLinks(() => setMobileOpen(false))}
          {user && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-300">{user.email}</span>
                <RoleBadge role={user.role} />
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-lg border border-slate-700 px-2.5 py-1 text-xs text-slate-200"
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main workspace */}
      <main className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}

