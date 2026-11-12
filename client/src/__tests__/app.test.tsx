import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes, createAppQueryClient } from '../App';
import { AuthProvider } from '../context/AuthContext';
import { ThemeProvider } from '../context/ThemeContext';
import { ToastProvider } from '../context/ToastContext';
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
    apiKeyPrefix: 'wpk_web123',
    active: true,
    secretRotatedAt: '2026-11-01T00:00:00.000Z',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
  },
  {
    _id: 'src-crm-2',
    name: 'CRM Deals',
    description: 'CRM deal pipeline webhook',
    schemaType: 'crm',
    apiKeyPrefix: 'wpk_crm123',
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
    payload: { fullName: 'Northstar Logistics', email: 'ops@northstar.test' },
    status: 'processed',
    errors: [],
    processingLogs: [
      {
        timestamp: '2026-11-12T09:00:01.000Z',
        stage: 'process',
        level: 'info',
        message: 'Processed successfully on attempt 1',
      },
    ],
    idempotencyKey: 'key-northstar-1',
    attempts: 1,
    maxAttempts: 4,
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
    payload: { name: 'ACME Renewal' },
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
        stage: 'retry',
        level: 'warn',
        message: 'Attempt 1/4 failed (Temporary downstream timeout); retry scheduled in 1000ms',
      },
    ],
    idempotencyKey: 'key-acme-failed-2',
    attempts: 2,
    maxAttempts: 4,
    nextRetryAt: '2026-11-12T09:15:00.000Z',
    deadLetteredAt: null,
    receivedAt: '2026-11-12T09:10:00.000Z',
    processedAt: null,
    recordId: null,
  },
];

const SAMPLE_SUMMARY = {
  total: 259,
  counts: {
    received: 0,
    valid: 3,
    processed: 191,
    invalid: 20,
    failed: 22,
    dead_letter: 23,
  },
  successRate: 73.7,
  avgProcessingMs: 245,
  lastEventReceivedAt: '2026-11-12T12:00:00.000Z',
  deltas: {
    totalPct: 12.5,
    processedPct: 18.2,
    invalidPct: -5,
    failedPct: 40,
    deadLetterPct: 25,
    attentionPct: 30,
    successRatePts: 3.4,
    avgProcessingMsPct: -8.1,
    comparisonLabel: '7d vs prior 7d',
  },
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
};

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
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <MemoryRouter initialEntries={initialEntries}>
              <AppRoutes />
            </MemoryRouter>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
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

  it('keeps access token strictly in memory during login flow and renders overview KPIs, deltas, and needs-attention panel for admin', async () => {
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
        return jsonResponse(SAMPLE_SUMMARY);
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
      if (url.startsWith('/api/events')) {
        return jsonResponse({
          items: [SAMPLE_EVENTS[1]],
          pagination: { page: 1, limit: 6, total: 1, totalPages: 1 },
        });
      }
      return jsonResponse({ error: { message: `Unhandled ${url}` } }, 404);
    });

    vi.stubGlobal('fetch', fetchMock);
    renderAppAt(['/']);

    // Redirects to split LoginPage when refresh fails
    expect(
      await screen.findByText(/Sign in to the operations dashboard/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/Event Processing Pipeline/i)).toBeInTheDocument();

    // Invalid credentials show error alert
    await user.type(screen.getByLabelText(/Email address/i), 'admin@workflow.local');
    await user.type(screen.getByLabelText(/Password/i), 'wrong-password');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');

    // Valid credentials redirect to Overview
    await user.clear(screen.getByLabelText(/Password/i));
    await user.type(screen.getByLabelText(/Password/i), 'valid-passphrase-123');
    await user.click(screen.getByRole('button', { name: /Sign in/i }));

    expect(
      await screen.findByRole('heading', { name: /Operational Overview/i })
    ).toBeInTheDocument();
    expect(await screen.findByText('259')).toBeInTheDocument();
    expect(await screen.findByText('Needs Attention')).toBeInTheDocument();
    expect(await screen.findByText(/Temporary downstream timeout/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Users/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Audit Log/i })).toBeInTheDocument();

    // Only theme preference may live in localStorage — access token stays strictly in memory
    expect(getAccessToken()).toBe('mem.jwt.token.admin');
    expect(window.localStorage.getItem('workflow_theme')).toBe('dark');
    expect(window.localStorage.length).toBe(1);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('hides admin navigation, write actions, and admin palette routes for viewer role', async () => {
    const user = userEvent.setup();
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
      return jsonResponse({ error: { message: `Unhandled ${url}` } }, 404);
    });

    vi.stubGlobal('fetch', fetchMock);
    renderAppAt(['/sources']);

    expect(await screen.findByRole('heading', { name: /Webhook Sources/i })).toBeInTheDocument();
    expect(await screen.findByText('Web Form Leads')).toBeInTheDocument();

    expect(screen.queryByRole('link', { name: /Users/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Audit Log/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New Source/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rotate Secret/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Disable/i })).not.toBeInTheDocument();

    // Command palette opens and excludes admin-only pages for viewer
    await user.keyboard('{Control>}k{/Control}');
    const palette = await screen.findByRole('dialog', { name: /Command palette/i });
    expect(within(palette).getByText('Events')).toBeInTheDocument();
    expect(within(palette).queryByText('Users')).not.toBeInTheDocument();
    expect(within(palette).queryByText('Audit Log')).not.toBeInTheDocument();
  });

  it('blocks viewer from admin routes and hides Replay button on failed event detail', async () => {
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
    expect(screen.getByText(/backoff 1 s/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Replay Event/i })).not.toBeInTheDocument();
  });

  it('filters events with status chips, opens row slide-over drawer, and persists theme preference', async () => {
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
      if (url.startsWith('/api/metrics/summary')) {
        return jsonResponse(SAMPLE_SUMMARY);
      }
      if (url === '/api/events/evt-failed-2') {
        return jsonResponse({ event: SAMPLE_EVENTS[1] });
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

    expect(await screen.findByText('key-northstar-1')).toBeInTheDocument();
    expect(screen.getByText('key-acme-failed-2')).toBeInTheDocument();

    // Filter by clicking status chip "Failed"
    await user.click(screen.getByRole('button', { name: /^Failed/i }));
    await waitFor(() => {
      expect(eventRequests.some((u) => u.includes('status=failed'))).toBe(true);
    });
    expect(screen.queryByText('key-northstar-1')).not.toBeInTheDocument();
    expect(screen.getByText('key-acme-failed-2')).toBeInTheDocument();

    // Clicking the event row opens the right-side Event quick inspector drawer
    await user.click(screen.getByText('key-acme-failed-2'));
    const drawer = await screen.findByRole('dialog', { name: /Event quick inspector/i });
    expect(within(drawer).getByText('Raw Webhook Payload')).toBeInTheDocument();
    expect(within(drawer).getByRole('button', { name: /Replay/i })).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: /Close event drawer/i }));

    // Filter by source = CRM Deals and search
    await user.selectOptions(screen.getByLabelText('Source filter'), 'src-crm-2');
    await user.type(screen.getByLabelText('Search events'), 'acme');
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

    // Light/dark theme toggle persists only theme preference
    await user.click(screen.getByRole('button', { name: /Switch to light theme/i }));
    expect(window.localStorage.getItem('workflow_theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });
});
