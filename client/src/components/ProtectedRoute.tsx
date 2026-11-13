import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import type { UserRole } from "../types/api";
import { LoadingState } from "./StateFeedback";

export function ProtectedRoute() {
  const { user, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--bg-page)] p-6">
        <div className="w-full max-w-md">
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
      <div className="rounded border border-[#FDBA74] bg-[#FFF7ED] p-6 text-center dark:border-[#52230B] dark:bg-[#2A150A]">
        <h2 className="text-sm font-semibold text-[#9A3412] dark:text-[#FB923C]">
          Access Restricted
        </h2>
        <p className="mt-1 text-xs text-[#6B6B66] dark:text-[#8E8B82]">
          Your role (
          <span className="font-mono font-medium text-[#1B1B1A] dark:text-[#ECE9E2]">
            {user.role}
          </span>
          ) does not have permission to view this page.
        </p>
      </div>
    );
  }

  return <Outlet />;
}
