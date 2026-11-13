import { apiRequest, buildQueryString } from "./http";
import type {
  AuditLogItem,
  EventStatus,
  MetricsSummary,
  MetricsTimeSeries,
  NormalizedRecord,
  PaginatedResponse,
  Source,
  SourceSchemaType,
  User,
  UserRole,
  WorkflowEvent,
} from "../types/api";

export const api = {
  login: (email: string, password: string) =>
    apiRequest<{ user: User; accessToken: string }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      skipAuthRefresh: true,
    }),

  logout: () =>
    apiRequest<{ message: string }>("/auth/logout", {
      method: "POST",
      skipAuthRefresh: true,
    }),

  getMetricsSummary: (params: {
    from?: string;
    to?: string;
    sourceId?: string;
  }) =>
    apiRequest<MetricsSummary>(`/metrics/summary${buildQueryString(params)}`),

  getMetricsTimeSeries: (params: {
    from?: string;
    to?: string;
    sourceId?: string;
    granularity?: "day" | "hour";
  }) =>
    apiRequest<MetricsTimeSeries>(
      `/metrics/timeseries${buildQueryString(params)}`,
    ),

  getEvents: (params: {
    page?: number;
    limit?: number;
    status?: EventStatus | string;
    sourceId?: string;
    from?: string;
    to?: string;
    search?: string;
  }) =>
    apiRequest<PaginatedResponse<WorkflowEvent>>(
      `/events${buildQueryString(params)}`,
    ),

  getEventDetail: (id: string) =>
    apiRequest<{ event: WorkflowEvent }>(`/events/${id}`),

  replayEvent: (id: string) =>
    apiRequest<{ event: WorkflowEvent }>(`/events/${id}/replay`, {
      method: "POST",
    }),

  getRecords: (params: {
    page?: number;
    limit?: number;
    sourceId?: string;
    category?: string;
    from?: string;
    to?: string;
    search?: string;
  }) =>
    apiRequest<PaginatedResponse<NormalizedRecord>>(
      `/records${buildQueryString(params)}`,
    ),

  getSources: (
    params: { page?: number; limit?: number; active?: boolean } = {},
  ) =>
    apiRequest<PaginatedResponse<Source>>(
      `/sources${buildQueryString(params)}`,
    ),

  createSource: (payload: {
    name: string;
    description?: string;
    schemaType: SourceSchemaType;
    active?: boolean;
  }) =>
    apiRequest<{
      source: Source;
      credentials: { apiKey: string; signingSecret: string };
    }>("/sources", { method: "POST", body: JSON.stringify(payload) }),

  updateSource: (
    id: string,
    payload: {
      name?: string;
      description?: string;
      schemaType?: SourceSchemaType;
      active?: boolean;
    },
  ) =>
    apiRequest<{ source: Source }>(`/sources/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  rotateSourceSecret: (id: string) =>
    apiRequest<{ source: Source; signingSecret: string }>(
      `/sources/${id}/rotate-secret`,
      {
        method: "POST",
      },
    ),

  getUsers: (
    params: {
      page?: number;
      limit?: number;
      role?: UserRole | "";
      search?: string;
    } = {},
  ) => apiRequest<PaginatedResponse<User>>(`/users${buildQueryString(params)}`),

  createUser: (payload: {
    name: string;
    email: string;
    password: string;
    role: UserRole;
  }) =>
    apiRequest<{ user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  updateUser: (
    id: string,
    payload: { name?: string; role?: UserRole; active?: boolean },
  ) =>
    apiRequest<{ user: User }>(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    }),

  getAuditLogs: (params: {
    page?: number;
    limit?: number;
    action?: string;
    resourceType?: string;
    from?: string;
    to?: string;
    search?: string;
  }) =>
    apiRequest<PaginatedResponse<AuditLogItem>>(
      `/audit-logs${buildQueryString(params)}`,
    ),
};
