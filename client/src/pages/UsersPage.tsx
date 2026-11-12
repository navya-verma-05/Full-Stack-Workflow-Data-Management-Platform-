import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Search, UserPlus } from 'lucide-react';
import { api } from '../api/endpoints';
import type { User, UserRole } from '../types/api';
import { ActiveBadge, RoleBadge } from '../components/StatusBadge';
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PaginationControls,
} from '../components/StateFeedback';

const ROLES: UserRole[] = ['admin', 'manager', 'viewer'];

export function UsersPage() {
  const queryClient = useQueryClient();

  const [page, setPage] = useState(1);
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('viewer');

  const usersQuery = useQuery({
    queryKey: ['users', { page, limit: 20, role: roleFilter, search }],
    queryFn: () => api.getUsers({ page, limit: 20, role: roleFilter, search }),
  });

  const createUserMutation = useMutation({
    mutationFn: () =>
      api.createUser({
        name: name.trim(),
        email: email.trim(),
        password,
        role: newRole,
      }),
    onSuccess: () => {
      setName('');
      setEmail('');
      setPassword('');
      setNewRole('viewer');
      setShowCreateForm(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: { role?: UserRole; active?: boolean } }) =>
      api.updateUser(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });

  const handleApplySearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createUserMutation.mutate();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white">Team & Roles</h1>
          <p className="mt-1 text-sm text-slate-400">
            Provision accounts and manage RBAC permissions for platform operators.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateForm((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white hover:bg-indigo-500"
        >
          <UserPlus className="h-4 w-4" />
          {showCreateForm ? 'Cancel' : 'New User'}
        </button>
      </div>

      {showCreateForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="rounded-xl border border-slate-800 bg-slate-900/70 p-4 space-y-4"
        >
          <h2 className="text-sm font-semibold text-white">Provision Team Member</h2>
          {createUserMutation.isError && (
            <ErrorState message={(createUserMutation.error as Error).message} />
          )}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <label htmlFor="user-name" className="block text-xs font-medium text-slate-300">
                Full name
              </label>
              <input
                id="user-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Alex Rivera"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="user-email" className="block text-xs font-medium text-slate-300">
                Email
              </label>
              <input
                id="user-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alex@workflow.local"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="user-password" className="block text-xs font-medium text-slate-300">
                Initial password (min 12 chars)
              </label>
              <input
                id="user-password"
                type="password"
                required
                minLength={12}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="StrongPassphrase123!"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="user-role" className="block text-xs font-medium text-slate-300">
                Role
              </label>
              <select
                id="user-role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as UserRole)}
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={createUserMutation.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {createUserMutation.isPending ? 'Creating user...' : 'Create User'}
            </button>
          </div>
        </form>
      )}

      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <select
            aria-label="Filter users by role"
            value={roleFilter}
            onChange={(e) => {
              setPage(1);
              setRoleFilter(e.target.value as UserRole | '');
            }}
            className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="">All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>

          <form onSubmit={handleApplySearch} className="flex gap-2 md:col-span-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
              <input
                aria-label="Search users"
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search by name or email..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-500"
            >
              Search
            </button>
          </form>
        </div>
      </div>

      {updateUserMutation.isError && (
        <ErrorState message={(updateUserMutation.error as Error).message} />
      )}

      {usersQuery.isLoading ? (
        <LoadingState label="Loading users..." />
      ) : usersQuery.isError ? (
        <ErrorState
          message={usersQuery.error.message}
          onRetry={() => usersQuery.refetch()}
        />
      ) : !usersQuery.data || usersQuery.data.items.length === 0 ? (
        <EmptyState
          title="No users match your filter"
          description="Try clearing the search query or role filter."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800 text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Last Login</th>
                  <th className="px-4 py-3 font-medium">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-slate-200">
                {usersQuery.data.items.map((u: User) => (
                  <tr key={u._id} className="hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-white">{u.name}</div>
                      <div className="text-[11px] text-slate-400">{u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <RoleBadge role={u.role} />
                    </td>
                    <td className="px-4 py-3">
                      <ActiveBadge active={u.active} />
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`Role for ${u.email}`}
                          value={u.role}
                          disabled={updateUserMutation.isPending}
                          onChange={(e) =>
                            updateUserMutation.mutate({
                              id: u._id,
                              payload: { role: e.target.value as UserRole },
                            })
                          }
                          className="rounded border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200 focus:border-indigo-500 focus:outline-none"
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          disabled={updateUserMutation.isPending}
                          onClick={() =>
                            updateUserMutation.mutate({
                              id: u._id,
                              payload: { active: !u.active },
                            })
                          }
                          className="rounded border border-slate-700 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-800 disabled:opacity-50"
                        >
                          {u.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <PaginationControls
            pagination={usersQuery.data.pagination}
            onPageChange={setPage}
          />
        </div>
      )}
    </div>
  );
}

