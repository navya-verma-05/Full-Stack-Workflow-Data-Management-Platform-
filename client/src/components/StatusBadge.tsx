import type { EventStatus, UserRole } from '../types/api';

const EVENT_STATUS_STYLES: Record<EventStatus, string> = {
  received: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  valid: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  processed: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  invalid: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  failed: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  dead_letter: 'bg-rose-500/15 text-rose-300 border-rose-500/30',
};

const ROLE_STYLES: Record<UserRole, string> = {
  admin: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  manager: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  viewer: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

export function StatusBadge({ status }: { status: EventStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${EVENT_STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${ROLE_STYLES[role]}`}
    >
      {role}
    </span>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${
        active
          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
          : 'bg-slate-700/40 text-slate-400 border-slate-600/40'
      }`}
    >
      {active ? 'Active' : 'Disabled'}
    </span>
  );
}

