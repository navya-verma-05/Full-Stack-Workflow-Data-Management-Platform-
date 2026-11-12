import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { UserRole } from '../types/api';
import { LoadingState } from './StateFeedback';

export function ProtectedRoute() {
  const { user, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
        <div className="w-full max-w-sm">
          <LoadingState label="Restoring secure session..." />
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export function RoleRoute({ allowedRoles }: { allowedRoles: UserRole[] }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(user.role)) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-6 text-center">
        <h2 className="text-base font-semibold text-rose-200">Access Restricted</h2>
        <p className="mt-1 text-sm text-slate-400">
          Your role (<span className="font-medium text-slate-200">{user.role}</span>) does not
          have permission to view this page.
        </p>
      </div>
    );
  }

  return <Outlet />;
}

