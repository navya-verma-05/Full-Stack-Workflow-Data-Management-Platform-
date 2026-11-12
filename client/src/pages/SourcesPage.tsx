import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, KeyRound, Plus, RefreshCw, ShieldAlert } from 'lucide-react';
import { api } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import type { SourceSchemaType } from '../types/api';
import { RelativeTime } from '../components/RelativeTime';
import { EmptyState, ErrorState, SkeletonTable } from '../components/StateFeedback';
import { ActiveBadge } from '../components/StatusBadge';

const SCHEMA_TYPES: { value: SourceSchemaType; label: string }[] = [
  { value: 'web_form', label: 'Web Form (web_form)' },
  { value: 'crm', label: 'CRM Deals (crm)' },
  { value: 'partner', label: 'Partner Orders (partner)' },
  { value: 'generic', label: 'Generic Client Payload (generic)' },
];

export function SourcesPage() {
  const { user } = useAuth();
  const toast = useToast();
  const isAdmin = user?.role === 'admin';
  const queryClient = useQueryClient();

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [schemaType, setSchemaType] = useState<SourceSchemaType>('web_form');
  const [oneTimeSecretBanner, setOneTimeSecretBanner] = useState<{
    sourceName: string;
    apiKey?: string;
    signingSecret: string;
  } | null>(null);

  const sourcesQuery = useQuery({
    queryKey: ['sources', { limit: 100 }],
    queryFn: () => api.getSources({ limit: 100 }),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      api.createSource({ name: name.trim(), description: description.trim(), schemaType }),
    onSuccess: (res) => {
      setOneTimeSecretBanner({
        sourceName: res.source.name,
        apiKey: res.credentials.apiKey,
        signingSecret: res.credentials.signingSecret,
      });
      toast.success('Source created', `${res.source.name} credentials issued once`);
      setName('');
      setDescription('');
      setSchemaType('web_form');
      setShowCreateForm(false);
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
    onError: (err) => {
      toast.error('Failed to create source', (err as Error).message);
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.updateSource(id, { active }),
    onSuccess: (res) => {
      toast.success(
        res.source.active ? 'Source enabled' : 'Source disabled',
        res.source.name
      );
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
    onError: (err) => {
      toast.error('Failed to update source', (err as Error).message);
    },
  });

  const rotateMutation = useMutation({
    mutationFn: (id: string) => api.rotateSourceSecret(id),
    onSuccess: (res) => {
      setOneTimeSecretBanner({
        sourceName: res.source.name,
        signingSecret: res.signingSecret,
      });
      toast.success('Signing secret rotated', `Save the new secret for ${res.source.name}`);
      queryClient.invalidateQueries({ queryKey: ['sources'] });
    },
    onError: (err) => {
      toast.error('Secret rotation failed', (err as Error).message);
    },
  });

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    createMutation.mutate();
  };

  const copyValue = async (label: string, val: string) => {
    try {
      await navigator.clipboard.writeText(val);
      toast.success(`Copied ${label}`);
    } catch {
      toast.error('Clipboard unavailable');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Webhook Sources
          </h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            External systems registered to deliver HMAC-SHA256 signed webhook payloads.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowCreateForm((prev) => !prev)}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white shadow-sm hover:bg-indigo-500"
          >
            <Plus className="h-4 w-4" />
            {showCreateForm ? 'Cancel' : 'New Source'}
          </button>
        )}
      </div>

      {oneTimeSecretBanner && (
        <div
          role="region"
          aria-label="One-time source credentials"
          className="rounded-xl border border-amber-500/40 bg-amber-50 p-4 text-xs text-amber-950 dark:bg-amber-950/30 dark:text-amber-100"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-300">
                <ShieldAlert className="h-4 w-4" />
                Save credentials for {oneTimeSecretBanner.sourceName} now — shown once only
              </div>
              {oneTimeSecretBanner.apiKey && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-amber-800/80 dark:text-amber-300/80">API Key: </span>
                  <code className="rounded bg-white px-2 py-0.5 font-mono text-amber-900 dark:bg-slate-950 dark:text-amber-200">
                    {oneTimeSecretBanner.apiKey}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyValue('API Key', oneTimeSecretBanner.apiKey!)}
                    className="rounded p-1 hover:bg-amber-200/50 dark:hover:bg-amber-900/50"
                    aria-label="Copy API key"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-amber-800/80 dark:text-amber-300/80">
                  HMAC Signing Secret:{' '}
                </span>
                <code className="rounded bg-white px-2 py-0.5 font-mono text-amber-900 dark:bg-slate-950 dark:text-amber-200">
                  {oneTimeSecretBanner.signingSecret}
                </code>
                <button
                  type="button"
                  onClick={() => copyValue('Signing Secret', oneTimeSecretBanner.signingSecret)}
                  className="rounded p-1 hover:bg-amber-200/50 dark:hover:bg-amber-900/50"
                  aria-label="Copy signing secret"
                >
                  <Copy className="h-3 w-3" />
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOneTimeSecretBanner(null)}
              className="rounded border border-amber-500/40 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 dark:text-amber-200 dark:hover:bg-amber-900/40"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {isAdmin && showCreateForm && (
        <form
          onSubmit={handleCreateSubmit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70"
        >
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Create Webhook Source
          </h2>
          {createMutation.isError && <ErrorState message={(createMutation.error as Error).message} />}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <label
                htmlFor="source-name"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Source name
              </label>
              <input
                id="source-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Marketing Web Form"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="source-schema"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Schema type
              </label>
              <select
                id="source-schema"
                value={schemaType}
                onChange={(e) => setSchemaType(e.target.value as SourceSchemaType)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              >
                {SCHEMA_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="source-desc"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300"
              >
                Description
              </label>
              <input
                id="source-desc"
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional integration notes"
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {createMutation.isPending ? 'Creating...' : 'Create Source'}
            </button>
          </div>
        </form>
      )}

      {sourcesQuery.isLoading ? (
        <SkeletonTable rows={4} cols={isAdmin ? 7 : 6} label="Loading webhook sources..." />
      ) : sourcesQuery.isError ? (
        <ErrorState message={sourcesQuery.error.message} onRetry={() => sourcesQuery.refetch()} />
      ) : !sourcesQuery.data || sourcesQuery.data.items.length === 0 ? (
        <EmptyState
          title="No webhook sources registered"
          description="Admins can create a webhook source to generate an API key and HMAC signing secret."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left text-xs dark:divide-slate-800">
              <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900/90 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Schema</th>
                  <th className="px-4 py-3 font-medium">Key Prefix</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Webhook Endpoint</th>
                  <th className="px-4 py-3 font-medium">Secret Rotated</th>
                  {isAdmin && <th className="px-4 py-3 font-medium">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800/80 dark:text-slate-200">
                {sourcesQuery.data.items.map((src) => (
                  <tr key={src._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-900 dark:text-white">{src.name}</div>
                      {src.description && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {src.description}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-600 dark:text-slate-300">
                      {src.schemaType}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      {src.apiKeyPrefix || '—'}
                    </td>
                    <td className="px-4 py-3">
                      <ActiveBadge active={src.active} />
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-500 dark:text-slate-400">
                      /api/webhooks/{src._id}
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                      <RelativeTime value={src.secretRotatedAt} />
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={toggleActiveMutation.isPending}
                            onClick={() =>
                              toggleActiveMutation.mutate({
                                id: src._id,
                                active: !src.active,
                              })
                            }
                            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1 text-[11px] text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                          >
                            <RefreshCw className="h-3 w-3" />
                            {src.active ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            type="button"
                            disabled={rotateMutation.isPending}
                            onClick={() => rotateMutation.mutate(src._id)}
                            className="inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-50 px-2.5 py-1 text-[11px] text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:bg-amber-950/30 dark:text-amber-200 dark:hover:bg-amber-900/40"
                          >
                            <KeyRound className="h-3 w-3" />
                            Rotate Secret
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
