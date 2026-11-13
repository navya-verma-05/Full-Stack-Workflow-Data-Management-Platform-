import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppRoutes, createAppQueryClient } from "../App";
import { AuthProvider } from "../context/AuthContext";
import { ThemeProvider } from "../context/ThemeContext";
import { ToastProvider } from "../context/ToastContext";
import { getAccessToken, setAccessToken } from "../api/http";
import type { Source, User, WorkflowEvent } from "../types/api";

const ADMIN_USER: User = {
  _id: "user-admin-1",
  name: "Platform Admin",
  email: "admin@workflow.local",
  role: "admin",
  active: true,
  lastLoginAt: "2026-11-12T10:00:00.000Z",
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-12T10:00:00.000Z",
};

const VIEWER_USER: User = {
  _id: "user-viewer-1",
  name: "Read Only Viewer",
  email: "viewer@workflow.local",
  role: "viewer",
  active: true,
  lastLoginAt: "2026-11-12T10:00:00.000Z",
  createdAt: "2026-11-01T00:00:00.000Z",
  updatedAt: "2026-11-12T10:00:00.000Z",
};

const SAMPLE_SOURCES: Source[] = [
  {
    _id: "src-web-1",
    name: "Web Form Leads",
    description: "Marketing site lead capture",
    schemaType: "web_form",
    apiKeyPrefix: "wpk_web123",
    active: true,
    secretRotatedAt: "2026-11-01T00:00:00.000Z",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  },
  {
    _id: "src-crm-2",
    name: "CRM Deals",
    description: "CRM deal pipeline webhook",
    schemaType: "crm",
    apiKeyPrefix: "wpk_crm123",
    active: true,
    secretRotatedAt: "2026-11-01T00:00:00.000Z",
    createdAt: "2026-11-01T00:00:00.000Z",
    updatedAt: "2026-11-01T00:00:00.000Z",
  },
];

const SAMPLE_EVENTS: WorkflowEvent[] = [
  {
    _id: "evt-processed-1",
    sourceId: {
      _id: "src-web-1",
      name: "Web Form Leads",
      schemaType: "web_form",
      active: true,
    },
    payload: { fullName: "Northstar Logistics", email: "ops@northstar.test" },
    status: "processed",
    errors: [],
    processingLogs: [
      {
        timestamp: "2026-11-12T09:00:01.000Z",
        stage: "process",
        level: "info",
        message: "Processed successfully on attempt 1",
      },
    ],
    idempotencyKey: "key-northstar-1",
    attempts: 1,
    maxAttempts: 4,
    nextRetryAt: null,
    deadLetteredAt: null,
    receivedAt: "2026-11-12T09:00:00.000Z",
    processedAt: "2026-11-12T09:00:02.000Z",
    recordId: null,
  },
  {
    _id: "evt-failed-2",
    sourceId: {
      _id: "src-crm-2",
      name: "CRM Deals",
      schemaType: "crm",
      active: true,
    },
    payload: { name: "ACME Renewal" },
    status: "failed",
    errors: [
      {
        field: "downstream",
        message: "Temporary downstream timeout",
        code: "RETRY_SCHEDULED",
      },
    ],
    processingLogs: [
      {
        timestamp: "2026-11-12T09:10:01.000Z",
        stage: "retry",
        level: "warn",
        message:
          "Attempt 1/4 failed (Temporary downstream timeout); retry scheduled in 1000ms",
      },
    ],
    idempotencyKey: "key-acme-failed-2",
    attempts: 2,
    maxAttempts: 4,
    nextRetryAt: "2026-11-12T09:15:00.000Z",
    deadLetteredAt: null,
    receivedAt: "2026-11-12T09:10:00.000Z",
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
  lastEventReceivedAt: "2026-11-12T12:00:00.000Z",
  deltas: {
    totalPct: 12.5,
    processedPct: 18.2,
    invalidPct: -5,
    failedPct: 40,
    deadLetterPct: 25,
    attentionPct: 30,
    successRatePts: 3.4,
    avgProcessingMsPct: -8.1,
    comparisonLabel: "vs prior 7d",
  },
  bySource: [
    {
      sourceId: "src-web-1",
      sourceName: "Web Form Leads",
      schemaType: "web_form",
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
    headers: { "Content-Type": "application/json" },
  });
}

function renderAppAt(initialEntries: string[] = ["/"]) {
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
    </QueryClientProvider>,
  );
}

describe("Workflow Platform Frontend", () => {
  beforeEach(() => {
    setAccessToken(null);
    window.localStorage.clear();
    window.sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it("renders login page and displays error alert on invalid credentials", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === "string" ? input : input.toString();

        if (url === "/api/auth/refresh") {
          return jsonResponse({ error: { message: "No refresh cookie" } }, 401);
        }
        if (url === "/api/auth/login") {
          const body = JSON.parse((init?.body as string) || "{}");
          if (body.password === "wrong-password") {
            return jsonResponse(
              { error: { message: "Invalid email or password" } },
              401,
            );
          }
        }
        return jsonResponse({ error: { message: `Unhandled ${url}` } }, 404);
      },
    );

    vi.stubGlobal("fetch", fetchMock);
    renderAppAt(["/login"]);

    expect(
      await screen.findByText(/Sign in to the operations dashboard/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/Event Processing Pipeline/i)).toBeInTheDocument();

    await user.type(
      screen.getByLabelText(/Email address/i),
      "admin@workflow.local",
    );
    await user.type(screen.getByLabelText(/Password/i), "wrong-password");
    await user.click(screen.getByRole("button", { name: /Sign in/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Invalid email or password",
    );
    expect(getAccessToken()).toBeNull();
  });

  it("keeps access token strictly in memory on successful login with zero web storage leaks", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/auth/refresh") {
        return jsonResponse({ error: { message: "No refresh cookie" } }, 401);
      }
      if (url === "/api/auth/login") {
        return jsonResponse({
          user: ADMIN_USER,
          accessToken: "mem.jwt.token.admin",
        });
      }
      if (url.startsWith("/api/metrics/summary")) {
        return jsonResponse(SAMPLE_SUMMARY);
      }
      if (url.startsWith("/api/metrics/time-series")) {
        return jsonResponse({ granularity: "day", buckets: [] });
      }
      if (url.startsWith("/api/sources")) {
        return jsonResponse({
          items: SAMPLE_SOURCES,
          pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
        });
      }
      if (url.startsWith("/api/events")) {
        return jsonResponse({
          items: [],
          pagination: { page: 1, limit: 6, total: 0, totalPages: 0 },
        });
      }
      return jsonResponse({ error: { message: `Unhandled ${url}` } }, 404);
    });

    vi.stubGlobal("fetch", fetchMock);
    renderAppAt(["/login"]);

    await user.type(
      await screen.findByLabelText(/Email address/i),
      "admin@workflow.local",
    );
    await user.type(screen.getByLabelText(/Password/i), "valid-passphrase-123");
    await user.click(screen.getByRole("button", { name: /Sign in/i }));

    expect(
      await screen.findByRole("heading", { name: /Operational Overview/i }),
    ).toBeInTheDocument();
    expect(getAccessToken()).toBe("mem.jwt.token.admin");

    // Only theme preference may reside in localStorage; web storage has zero auth tokens
    expect(window.localStorage.getItem("workflow_theme")).toBe("dark");
    expect(window.localStorage.getItem("token")).toBeNull();
    expect(window.localStorage.getItem("accessToken")).toBeNull();
    expect(window.sessionStorage.length).toBe(0);
  });

  it("renders overview KPI metrics, comparison deltas, and last event received time", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/auth/refresh") {
        return jsonResponse({
          user: ADMIN_USER,
          accessToken: "mem.jwt.token.admin",
        });
      }
      if (url.startsWith("/api/metrics/summary")) {
        return jsonResponse(SAMPLE_SUMMARY);
      }
      if (url.startsWith("/api/metrics/time-series")) {
        return jsonResponse({ granularity: "day", buckets: [] });
      }
      if (url.startsWith("/api/sources")) {
        return jsonResponse({
          items: SAMPLE_SOURCES,
          pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
        });
      }
      if (url.startsWith("/api/events")) {
        return jsonResponse({
          items: [],
          pagination: { page: 1, limit: 6, total: 0, totalPages: 0 },
        });
      }
      return jsonResponse({ error: { message: `Unhandled ${url}` } }, 404);
    });

    vi.stubGlobal("fetch", fetchMock);
    renderAppAt(["/"]);

    expect(
      await screen.findByRole("heading", { name: /Operational Overview/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText("259")).toBeInTheDocument();
    expect(screen.getByText("73.7%")).toBeInTheDocument();
    expect(screen.getByText(/245\s*ms/i)).toBeInTheDocument();
    expect(screen.getAllByText(/vs prior 7d/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Last event received/i)).toBeInTheDocument();
  });

  it("renders needs-attention panel with failed events and inline replay action for admin", async () => {
    const user = userEvent.setup();
    let replayed = false;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/auth/refresh") {
        return jsonResponse({
          user: ADMIN_USER,
          accessToken: "mem.jwt.token.admin",
        });
      }
      if (url.startsWith("/api/metrics/summary")) {
        return jsonResponse(SAMPLE_SUMMARY);
      }
      if (url.startsWith("/api/metrics/time-series")) {
        return jsonResponse({ granularity: "day", buckets: [] });
      }
      if (url.startsWith("/api/sources")) {
        return jsonResponse({
          items: SAMPLE_SOURCES,
          pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
        });
      }
      if (
        url.startsWith("/api/events") &&
        url.includes("status=failed%2Cdead_letter")
      ) {
        return jsonResponse({
          items: [SAMPLE_EVENTS[1]],
          pagination: { page: 1, limit: 6, total: 1, totalPages: 1 },
        });
      }
      if (url === "/api/events/evt-failed-2/replay") {
        replayed = true;
        return jsonResponse({
          message: "Event marked valid for immediate replay",
        });
      }
      return jsonResponse({ error: { message: `Unhandled ${url}` } }, 404);
    });

    vi.stubGlobal("fetch", fetchMock);
    renderAppAt(["/"]);

    expect(await screen.findByText("Needs Attention")).toBeInTheDocument();
    expect(
      await screen.findByText(/Temporary downstream timeout/i),
    ).toBeInTheDocument();

    const replayBtn = screen.getByRole("button", { name: /Replay/i });
    expect(replayBtn).toBeInTheDocument();
    await user.click(replayBtn);
    expect(replayed).toBe(true);
  });

  it("hides write actions, admin navigation links, and secret rotation buttons for viewer role", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/auth/refresh") {
        return jsonResponse({
          user: VIEWER_USER,
          accessToken: "mem.jwt.token.viewer",
        });
      }
      if (url.startsWith("/api/sources")) {
        return jsonResponse({
          items: SAMPLE_SOURCES,
          pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
        });
      }
      return jsonResponse({ error: { message: `Unhandled ${url}` } }, 404);
    });

    vi.stubGlobal("fetch", fetchMock);
    renderAppAt(["/sources"]);

    expect(
      await screen.findByRole("heading", { name: /Webhook Sources/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Web Form Leads")).toBeInTheDocument();

    expect(
      screen.queryByRole("link", { name: /Users/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /Audit Log/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /New Source/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Rotate Secret/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Disable/i }),
    ).not.toBeInTheDocument();
  });

  it("restricts command palette navigation and search entries by user role", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/auth/refresh") {
        return jsonResponse({
          user: VIEWER_USER,
          accessToken: "mem.jwt.token.viewer",
        });
      }
      if (url.startsWith("/api/sources")) {
        return jsonResponse({
          items: SAMPLE_SOURCES,
          pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
        });
      }
      return jsonResponse({ error: { message: `Unhandled ${url}` } }, 404);
    });

    vi.stubGlobal("fetch", fetchMock);
    renderAppAt(["/sources"]);

    await screen.findByRole("heading", { name: /Webhook Sources/i });

    // Open palette with Ctrl+K
    await user.keyboard("{Control>}k{/Control}");
    const palette = await screen.findByRole("dialog", {
      name: /Command palette/i,
    });

    expect(within(palette).getByText("Events")).toBeInTheDocument();
    expect(within(palette).getByText("Sources")).toBeInTheDocument();
    // Admin-only pages excluded for viewer
    expect(within(palette).queryByText("Users")).not.toBeInTheDocument();
    expect(within(palette).queryByText("Audit Log")).not.toBeInTheDocument();
  });

  it("guards protected admin routes (/users) against unauthorized viewer access", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/auth/refresh") {
        return jsonResponse({
          user: VIEWER_USER,
          accessToken: "mem.jwt.token.viewer",
        });
      }
      return jsonResponse({ error: { message: `Unhandled ${url}` } }, 404);
    });

    vi.stubGlobal("fetch", fetchMock);
    renderAppAt(["/users"]);

    expect(await screen.findByText(/Access Restricted/i)).toBeInTheDocument();
    expect(
      screen.getByText(/does not have permission to view this page/i),
    ).toBeInTheDocument();
  });

  it("renders event detail side-by-side payload and retry backoff badges with role-aware replay", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/auth/refresh") {
        return jsonResponse({
          user: VIEWER_USER,
          accessToken: "mem.jwt.token.viewer",
        });
      }
      if (url === "/api/events/evt-failed-2") {
        return jsonResponse({ event: SAMPLE_EVENTS[1] });
      }
      return jsonResponse({ error: { message: `Unhandled ${url}` } }, 404);
    });

    vi.stubGlobal("fetch", fetchMock);
    renderAppAt(["/events/evt-failed-2"]);

    expect(await screen.findByText(/Event evt-failed-2/i)).toBeInTheDocument();
    expect(screen.getByText(/backoff 1 s/i)).toBeInTheDocument();
    expect(screen.getByText(/Raw Webhook Payload/i)).toBeInTheDocument();
    expect(
      screen.getByText(/No Normalized Record Created/i),
    ).toBeInTheDocument();
    // Viewer cannot see Replay Event button
    expect(
      screen.queryByRole("button", { name: /Replay Event/i }),
    ).not.toBeInTheDocument();
  });

  it("filters events by status chips and updates active filter query", async () => {
    const user = userEvent.setup();
    const eventRequests: string[] = [];

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/auth/refresh") {
        return jsonResponse({
          user: ADMIN_USER,
          accessToken: "mem.jwt.token.admin",
        });
      }
      if (url.startsWith("/api/sources")) {
        return jsonResponse({
          items: SAMPLE_SOURCES,
          pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
        });
      }
      if (url.startsWith("/api/metrics/summary")) {
        return jsonResponse(SAMPLE_SUMMARY);
      }
      if (url.startsWith("/api/events")) {
        eventRequests.push(url);
        const queryPart = url.split("?")[1] || "";
        const params = new URLSearchParams(queryPart);
        const statusParam = params.get("status") || "";

        const filtered = SAMPLE_EVENTS.filter((evt) => {
          if (statusParam && evt.status !== statusParam) return false;
          return true;
        });

        return jsonResponse({
          items: filtered,
          pagination: {
            page: 1,
            limit: 20,
            total: filtered.length,
            totalPages: 1,
          },
        });
      }
      return jsonResponse({ error: { message: `Unhandled ${url}` } }, 404);
    });

    vi.stubGlobal("fetch", fetchMock);
    renderAppAt(["/events"]);

    expect(await screen.findByText("key-northstar-1")).toBeInTheDocument();
    expect(screen.getByText("key-acme-failed-2")).toBeInTheDocument();

    // Click Failed status chip
    await user.click(screen.getByRole("button", { name: /^Failed/i }));
    await waitFor(() => {
      expect(eventRequests.some((u) => u.includes("status=failed"))).toBe(true);
    });

    expect(screen.queryByText("key-northstar-1")).not.toBeInTheDocument();
    expect(screen.getByText("key-acme-failed-2")).toBeInTheDocument();
  });

  it("opens event quick inspector drawer on row click and allows quick replay", async () => {
    const user = userEvent.setup();
    let replayed = false;

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/auth/refresh") {
        return jsonResponse({
          user: ADMIN_USER,
          accessToken: "mem.jwt.token.admin",
        });
      }
      if (url.startsWith("/api/sources")) {
        return jsonResponse({
          items: SAMPLE_SOURCES,
          pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
        });
      }
      if (url.startsWith("/api/metrics/summary")) {
        return jsonResponse(SAMPLE_SUMMARY);
      }
      if (url === "/api/events/evt-failed-2") {
        return jsonResponse({ event: SAMPLE_EVENTS[1] });
      }
      if (url === "/api/events/evt-failed-2/replay") {
        replayed = true;
        return jsonResponse({ message: "Event queued for retry" });
      }
      if (url.startsWith("/api/events")) {
        return jsonResponse({
          items: [SAMPLE_EVENTS[1]],
          pagination: { page: 1, limit: 20, total: 1, totalPages: 1 },
        });
      }
      return jsonResponse({ error: { message: `Unhandled ${url}` } }, 404);
    });

    vi.stubGlobal("fetch", fetchMock);
    renderAppAt(["/events"]);

    const rowItem = await screen.findByText("key-acme-failed-2");
    await user.click(rowItem);

    const drawer = await screen.findByRole("dialog", {
      name: /Event quick inspector/i,
    });
    expect(within(drawer).getByText("Raw Webhook Payload")).toBeInTheDocument();

    const replayBtn = within(drawer).getByRole("button", { name: /Replay/i });
    expect(replayBtn).toBeInTheDocument();
    await user.click(replayBtn);
    expect(replayed).toBe(true);

    await user.click(
      within(drawer).getByRole("button", { name: /Close event drawer/i }),
    );
  });

  it("toggles light and dark theme mode and persists only theme preference to localStorage", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();

      if (url === "/api/auth/refresh") {
        return jsonResponse({
          user: ADMIN_USER,
          accessToken: "mem.jwt.token.admin",
        });
      }
      if (url.startsWith("/api/sources")) {
        return jsonResponse({
          items: SAMPLE_SOURCES,
          pagination: { page: 1, limit: 100, total: 2, totalPages: 1 },
        });
      }
      if (url.startsWith("/api/metrics/summary")) {
        return jsonResponse(SAMPLE_SUMMARY);
      }
      if (url.startsWith("/api/events")) {
        return jsonResponse({
          items: [],
          pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
        });
      }
      return jsonResponse({ error: { message: `Unhandled ${url}` } }, 404);
    });

    vi.stubGlobal("fetch", fetchMock);
    renderAppAt(["/events"]);

    await screen.findByRole("heading", { name: /Webhook Events/i });

    const toggleBtn = screen.getByRole("button", {
      name: /Switch to light theme/i,
    });
    await user.click(toggleBtn);

    expect(window.localStorage.getItem("workflow_theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    // Switch back to dark
    const darkBtn = screen.getByRole("button", {
      name: /Switch to dark theme/i,
    });
    await user.click(darkBtn);
    expect(window.localStorage.getItem("workflow_theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
