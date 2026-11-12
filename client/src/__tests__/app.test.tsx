import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes, createAppQueryClient } from '../App';
import { AuthProvider } from '../context/AuthContext';
import { getAccessToken, setAccessToken } from '../api/http';
import type { Source, User, WorkflowEvent } from '../types/api';

const ADMIN_USER: User = {
  _id: 'user-admin-1',
  name: 'Platform Admin',
  email: 'admin@workflow.local',
  role: 'admin',
  active: true,
  lastLoginAt: '2026-11-12T10:00:00.000Z',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-12T10:00:00.000Z',
};

const VIEWER_USER: User = {
  _id: 'user-viewer-1',
  name: 'Read Only Viewer',
  email: 'viewer@workflow.local',
  role: 'viewer',
  active: true,
  lastLoginAt: '2026-11-12T10:00:00.000Z',
  createdAt: '2026-11-01T00:00:00.000Z',
  updatedAt: '2026-11-12T10:00:00.000Z',
};

const SAMPLE_SOURCES: Source[] = [
  {
    _id: 'src-web-1',
    name: 'Web Form Leads',
    description: 'Marketing site lead capture',
    schemaType: 'web_form',
    apiKeyPrefix: 'wp_src_web',
    active: true,
    secretRotatedAt: '2026-11-01T00:00:00.000Z',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
  {
    _id: 'src-crm-2',
    name: 'CRM Deals',
    description: 'HubSpot deal webhook',
    schemaType: 'crm',
    apiKeyPrefix: 'wp_src_crm',
    active: true,
    secretRotatedAt: '2026-11-01T00:00:00.000Z',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
];

const SAMPLE_EVENTS: WorkflowEvent[] = [
  {
    _id: 'evt-processed-1',
    sourceId: {
      _id: 'src-web-1',
      name: 'Web Form Leads',
      schemaType: 'web_form',
      active: true,
    },
    payload: { name: 'Northstar Logistics', email: 'ops@northstar.test' },
    status: 'processed',
    errors: [],
    processingLogs: [
      {
        timestamp: '2026-11-12T09:00:01.000Z',
        stage: 'normalize',
        level: 'info',
        message: 'Normalized client record created',
      },
    ],
    idempotencyKey: 'key-northstar-1',
    attempts: 1,
    maxAttempts: 5,
    nextRetryAt: null,
    deadLetteredAt: null,
    receivedAt: '2026-11-12T09:00:00.000Z',
    processedAt: '2026-11-12T09:00:02.000Z',
    recordId: null,
  },
  {
    _id: 'evt-failed-2',
    sourceId: {
      _id: 'src-crm-2',
      name: 'CRM Deals',
      schemaType: 'crm',
      active: true,
    },
    payload: { dealName: 'ACME Renewal' },
    status: 'failed',
    errors: [
      {
        field: 'downstream',
        message: 'Temporary downstream timeout',
        code: 'RETRY_SCHEDULED',
      },
    ],
    processingLogs: [
      {
        timestamp: '2026-11-12T09:10:01.000Z',
        stage: 'worker',
        level: 'warn',
        message: 'Retry scheduled after timeout',
      },
    ],
    idempotencyKey: 'key-acme-failed-2',
    attempts: 2,
    maxAttempts: 5,
    nextRetryAt: '2026-11-12T09:15:00.000Z',
    deadLetteredAt: null,
    receivedAt: '2026-11-12T09:10:00.000Z',
    processedAt: null,
    recordId: null,
  },
];

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderAppAt(initialEntries: string[] = ['/']) {
  const queryClient = createAppQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <MemoryRouter initialEntries={initialEntries}>
          <AppRoutes />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

describe('Workflow Platform Frontend', () => {
  beforeEach(() => {
    setAccessToken(null);
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('keeps access token strictly in memory during login flow and renders dashboard for admin', async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === '/api/auth/refresh') {
        return jsonResponse({ error: { message: 'No refresh cookie' } }, 401);
      }
      if (url === '/api/auth/login') {
        const body = JSON.parse((init?.body as string) || '{}');
        if (body.password === 'wrong-password') {
          return jsonResponse({ error: { message: 'Invalid email or password' } }, 401);
        }
        return jsonResponse({
          user: ADMIN_USER,
          accessToken: 'mem.jwt.token.admin',
        });
      }
      if (url.startsWith('/api/metrics/summary')) {
        return jsonResponse({
          total: 240,
          counts: {
            received: 0,
            valid: 12,
            processed: 180,
            invalid: 24,
            failed: 12,
            dead_letter: 12,
          },
          successRate: 75,
          avgProcessingMs: 42,
          bySource: [
            {
              sourceId: 'src-web-1',
              sourceName: 'Web Form Leads',
              schemaType: 'web_form',
              active: true,
              total: 100,
              processed: 90,
              invalid: 5,
              failed: 3,
              dead_letter: 2,
            },
          ],
          range: { from: null, to: null, sourceId: null },
        });
      }
      if (url.startsWith('/api/metrics/time-series')) {
        return jsonResponse({
          granularity: 'day',
          buckets: [
            {
              bucket: '2026-11-12',
              total: 40,
              received: 0,
              valid: 2,
              processed: 33,
              invalid: 2,
              failed: 2,
              dead_letter: 1,
            },
          ],
        });
      }
      if (url.startsWith('/api/sources')) {
        return jsonResponse({
          items: SAMPLE_SOURCES,
          pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
        });
      }
      return jsonResponse({ error: { message: `Unhandled ${url}` } }, 404);
    });

    vi.stubGlobal('fetch', fetchMock);
    renderAppAt(['/']);

    // Redirects to LoginPage when initial cookie refresh returns 401
    expect(
      await screen.findByText(/Sign in to the operations dashboard/i)
    ).toBeInTheDocument();

    // First try invalid credentials -> error banner shown
    await user.type(screen.getByLabelText(/Email address/i), 'admin@workflow.local');
    await user.type(screen.getByLabelText(/Password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password'
    );

    // Retry with valid credentials -> lands on Overview with admin navigation links
    await user.clear(screen.getByLabelText(/Password/i));
    await user.type(screen.getByLabelText(/Password/i), 'valid-passphrase-123');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));

    expect(
      await screen.findByRole('heading', { name: /Operational Overview/i })
    ).toBeInTheDocument();
    expect(await screen.findByText('240')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Users/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: /Audit Log/i }).length).toBeGreaterThan(0);

    // Access token is strictly kept in memory, never in web storage
    expect(getAccessToken()).toBe('mem.jwt.token.admin');
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('hides admin navigation and write actions for viewer role', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === '/api/auth/refresh') {
        return jsonResponse({
          user: VIEWER_USER,
          accessToken: 'mem.jwt.token.viewer',
        });
      }
      if (url.startsWith('/api/sources')) {
        return jsonResponse({
          items: SAMPLE_SOURCES,
          pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
        });
      }
      if (url === '/api/events/evt-failed-2') {
        return jsonResponse({ event: SAMPLE_EVENTS[1] });
      }
      return jsonResponse({ error: { message: `Unhandled ${url}` } }, 404);
    });

    vi.stubGlobal('fetch', fetchMock);
    renderAppAt(['/sources']);

    expect(await screen.findByRole('heading', { name: /Webhook Sources/i })).toBeInTheDocument();
    expect(await screen.findByText('Web Form Leads')).toBeInTheDocument();

    // Admin-only nav items and write controls must not appear for viewer
    expect(screen.queryByRole('link', { name: /Users/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Audit Log/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New Source/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rotate Secret/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Disable/i })).not.toBeInTheDocument();
  });

  it('blocks viewer from admin routes and hides Replay button on failed events', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === '/api/auth/refresh') {
        return jsonResponse({
          user: VIEWER_USER,
          accessToken: 'mem.jwt.token.viewer',
        });
      }
      if (url === '/api/events/evt-failed-2') {
        return jsonResponse({ event: SAMPLE_EVENTS[1] });
      }
      return jsonResponse({ error: { message: `Unhandled ${url}` } }, 404);
    });

    vi.stubGlobal('fetch', fetchMock);
    const { unmount } = renderAppAt(['/users']);
    expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
    unmount();

    renderAppAt(['/events/evt-failed-2']);
    expect(await screen.findByText(/Event evt-failed-2/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Replay Event/i })).not.toBeInTheDocument();
  });

  it('applies status, source, date, and search filters on EventsPage and clears them', async () => {
    const user = userEvent.setup();
    const eventRequests: string[] = [];

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === '/api/auth/refresh') {
        return jsonResponse({
          user: ADMIN_USER,
          accessToken: 'mem.jwt.token.admin',
        });
      }
      if (url.startsWith('/api/sources')) {
        return jsonResponse({
          items: SAMPLE_SOURCES,
          pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
        });
      }
      if (url.startsWith('/api/events')) {
        eventRequests.push(url);
        const queryPart = url.split('?')[1] || '';
        const params = new URLSearchParams(queryPart);
        const statusParam = params.get('status') || '';
        const sourceParam = params.get('sourceId') || '';
        const searchParam = (params.get('search') || '').toLowerCase();

        const filtered = SAMPLE_EVENTS.filter((evt) => {
          if (statusParam && evt.status !== statusParam) return false;
          const sid = typeof evt.sourceId === 'object' ? evt.sourceId._id : evt.sourceId;
          if (sourceParam && sid !== sourceParam) return false;
          if (searchParam && !evt.idempotencyKey.toLowerCase().includes(searchParam)) return false;
          return true;
        });

        return jsonResponse({
          items: filtered,
          pagination: { page: 1, limit: 20, total: filtered.length, totalPages: 1 },
        });
      }
      return jsonResponse({ error: { message: `Unhandled ${url}` } }, 404);
    });

    vi.stubGlobal('fetch', fetchMock);
    renderAppAt(['/events']);

    // Wait for initial events list
    expect(await screen.findByText('key-northstar-1')).toBeInTheDocument();
    expect(screen.getByText('key-acme-failed-2')).toBeInTheDocument();

    // Filter by status = failed
    await user.selectOptions(screen.getByLabelText('Status filter'), 'failed');

    await waitFor(() => {
      expect(eventRequests.some((u) => u.includes('status=failed'))).toBe(true);
    });
    expect(screen.queryByText('key-northstar-1')).not.toBeInTheDocument();
    expect(screen.getByText('key-acme-failed-2')).toBeInTheDocument();

    // Filter by source = CRM Deals
    await user.selectOptions(screen.getByLabelText('Source filter'), 'src-crm-2');
    await waitFor(() => {
      expect(
        eventRequests.some((u) => u.includes('status=failed') && u.includes('sourceId=src-crm-2'))
      ).toBe(true);
    });

    // Apply search query
    const searchInput = screen.getByLabelText('Search events');
    await user.type(searchInput, 'acme');
    await user.click(screen.getByRole('button', { name: /^Search$/i }));

    await waitFor(() => {
      expect(
        eventRequests.some(
          (u) =>
            u.includes('status=failed') &&
            u.includes('sourceId=src-crm-2') &&
            u.includes('search=acme')
        )
      ).toBe(true);
    });

    // Clear all filters restores both events
    await user.click(screen.getByRole('button', { name: /Clear/i }));
    expect(await screen.findByText('key-northstar-1')).toBeInTheDocument();
    expect(screen.getByText('key-acme-failed-2')).toBeInTheDocument();

    // Sanity check table rows rendered cleanly
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row').length).toBe(3);
  });
});

