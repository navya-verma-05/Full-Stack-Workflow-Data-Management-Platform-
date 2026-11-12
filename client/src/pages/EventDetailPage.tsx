import { Link, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, RotateCcw } from 'lucide-react';
import { api } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, LoadingState } from '../components/StateFeedback';
import type { NormalizedRecord, Source } from '../types/api';

export function EventDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const detailQuery = useQuery({
    queryKey: ['event-detail', id],
    queryFn: () => api.getEventDetail(id),
    enabled: Boolean(id),
  });

  const replayMutation = useMutation({
    mutationFn: () => api.replayEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-detail', id] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['metrics-summary'] });
    },
  });

  if (detailQuery.isLoading) {
    return <LoadingState label="Loading event details..." />;
  }

  if (detailQuery.isError) {
    return (
      <ErrorState
        message={detailQuery.error.message}
        onRetry={() => detailQuery.refetch()}
      />
    );
  }

  const event = detailQuery.data?.event;
  if (!event) return null;

  const canReplay =
    (user?.role === 'admin' || user?.role === 'manager') &&
    (event.status === 'failed' || event.status === 'dead_letter');

  const source =
    typeof event.sourceId === 'object' && event.sourceId !== null
      ? (event.sourceId as Pick<Source, '_id' | 'name' | 'schemaType' | 'active'>)
      : null;

  const record =
    typeof event.recordId === 'object' && event.recordId !== null
      ? (event.recordId as NormalizedRecord)
      : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <Link
            to="/events"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-400 hover:text-indigo-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to events
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold text-white">Event {event._id}</h1>
            <StatusBadge status={event.status} />
          </div>
          <p className="font-mono text-xs text-slate-400">
            Idempotency key: {event.idempotencyKey}
          </p>
        </div>

        {canReplay && (
          <button
            type="button"
            disabled={replayMutation.isPending}
            onClick={() => replayMutation.mutate()}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
          >
            <RotateCcw className="h-4 w-4" />
            {replayMutation.isPending ? 'Queuing replay...' : 'Replay Event'}
          </button>
        )}
      </div>

      {replayMutation.isError && (
        <ErrorState message={(replayMutation.error as Error).message} />
      )}

      {replayMutation.isSuccess && (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-950/30 px-4 py-2.5 text-sm text-emerald-200">
          Event re-queued for asynchronous worker processing.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <InfoTile label="Source" value={source ? `${source.name} (${source.schemaType})` : 'Unknown'} />
        <InfoTile label="Attempts" value={`${event.attempts} / ${event.maxAttempts}`} />
        <InfoTile label="Received At" value={new Date(event.receivedAt).toLocaleString()} />
        <InfoTile
          label="Processed At"
          value={event.processedAt ? new Date(event.processedAt).toLocaleString() : 'Not processed'}
        />
      </div>

      {event.errors.length > 0 && (
        <section className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-5">
          <h2 className="mb-3 text-sm font-semibold text-amber-200">Validation Errors</h2>
          <ul className="space-y-2 text-xs">
            {event.errors.map((err, idx) => (
              <li
                key={`${err.field}-${idx}`}
                className="rounded-lg border border-amber-500/20 bg-slate-950/60 px-3 py-2 text-amber-100"
              >
                <span className="font-mono font-semibold text-amber-300">{err.field}</span>:{' '}
                {err.message} <span className="text-slate-500">({err.code})</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="mb-4 text-sm font-semibold text-slate-200">Processing Timeline</h2>
          {event.processingLogs.length === 0 ? (
            <p className="text-xs text-slate-400">No processing logs recorded.</p>
          ) : (
            <ol className="space-y-3 border-l border-slate-700 pl-4">
              {event.processingLogs.map((log, idx) => (
                <li key={idx} className="relative text-xs">
                  <span
                    className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${
                      log.level === 'error'
                        ? 'bg-rose-400'
                        : log.level === 'warn'
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                    }`}
                  />
                  <div className="flex items-center gap-2 text-slate-400">
                    <span className="font-mono uppercase text-indigo-300">{log.stage}</span>
                    <span>•</span>
                    <span>{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  <p className="mt-0.5 text-slate-200">{log.message}</p>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-200">Raw Webhook Payload</h2>
          <pre className="max-h-72 overflow-auto rounded-lg bg-slate-950 p-4 font-mono text-xs text-slate-200">
            {JSON.stringify(event.payload, null, 2)}
          </pre>

          {record && (
            <div className="mt-5 border-t border-slate-800 pt-4">
              <h3 className="mb-2 text-sm font-semibold text-emerald-300">Normalized Record</h3>
              <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
                <div>
                  <span className="text-slate-500">Client:</span> {record.clientName}
                </div>
                <div>
                  <span className="text-slate-500">Email:</span> {record.clientEmail || '-'}
                </div>
                <div>
                  <span className="text-slate-500">Company:</span> {record.company || '-'}
                </div>
                <div>
                  <span className="text-slate-500">Amount:</span> {record.amount} {record.currency}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <p className="text-xs text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-medium text-white">{value}</p>
    </div>
  );
}

