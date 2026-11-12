const API_BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

// Access token is kept strictly in module memory (never localStorage or sessionStorage).
let inMemoryAccessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let onAuthFailure: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getAccessToken() {
  return inMemoryAccessToken;
}

export function setAuthFailureHandler(handler: (() => void) | null) {
  onAuthFailure = handler;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status: number, code = 'API_ERROR', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function refreshAccessToken(): Promise<{
  accessToken: string;
  user: import('../types/api').User;
} | null> {
  const res = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!res.ok) {
    setAccessToken(null);
    return null;
  }

  const data = await res.json();
  setAccessToken(data.accessToken);
  return data;
}

async function getRefreshedTokenSingleFlight(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = refreshAccessToken()
      .then((res) => res?.accessToken || null)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit & { skipAuthRefresh?: boolean } = {}
): Promise<T> {
  const { skipAuthRefresh = false, headers, ...rest } = options;

  const makeHeaders = (token: string | null) => ({
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  });

  let response = await fetch(`${API_BASE}${path}`, {
    ...rest,
    credentials: 'include',
    headers: makeHeaders(inMemoryAccessToken),
  });

  if (
    response.status === 401 &&
    !skipAuthRefresh &&
    !path.startsWith('/auth/login') &&
    !path.startsWith('/auth/refresh')
  ) {
    const newToken = await getRefreshedTokenSingleFlight();
    if (newToken) {
      response = await fetch(`${API_BASE}${path}`, {
        ...rest,
        credentials: 'include',
        headers: makeHeaders(newToken),
      });
    } else if (onAuthFailure) {
      onAuthFailure();
    }
  }

  const text = await response.text();
  const body = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = body?.error?.message || `Request failed with status ${response.status}`;
    const code = body?.error?.code || 'API_ERROR';
    throw new ApiError(message, response.status, code, body?.error?.details);
  }

  return body as T;
}

export function buildQueryString(params: Record<string, string | number | boolean | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') {
      sp.set(k, String(v));
    }
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : '';
}

