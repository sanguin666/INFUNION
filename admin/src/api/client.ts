export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const TOKEN_STORAGE_KEY = 'ansae-admin-token';

const SUPERADMIN_STORAGE_KEY = 'ansae-superadmin-session';

export type SuperadminSession = { token: string; expiresAt: string };

/**
 * The superadmin's second token, from the six-digit code. Kept in this
 * tab's sessionStorage only: closing the tab ends it, and it never sits
 * on disk next to the ordinary session.
 */
export function getSuperadminSession(): SuperadminSession | null {
  try {
    const raw = sessionStorage.getItem(SUPERADMIN_STORAGE_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as SuperadminSession;
    if (new Date(session.expiresAt).getTime() - 15_000 <= Date.now()) {
      sessionStorage.removeItem(SUPERADMIN_STORAGE_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function setSuperadminSession(session: SuperadminSession | null): void {
  try {
    if (session) sessionStorage.setItem(SUPERADMIN_STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(SUPERADMIN_STORAGE_KEY);
  } catch {
    // A browser that refuses storage simply asks for the code again.
  }
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string | null): void {
  if (token) {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(
  path: string,
  options: { method?: string; body?: BodyInit; headers?: Record<string, string> } = {},
): Promise<T> {
  // While the superadmin's code session lasts it is used everywhere, so
  // "Ouvrir son admin" works in any community; the server only accepts it
  // there from the superadmin.
  const token = getSuperadminSession()?.token ?? getToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    body: options.body,
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(payload?.message ?? response.statusText, response.status);
  }

  // NestJS returns 200 (not 204) with an empty body for controller methods
  // that resolve to void (e.g. our delete endpoints), so check the body
  // itself rather than trusting the status code.
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
  });
}

// No Content-Type header here — fetch sets the multipart boundary itself
// when the body is a FormData instance.
export function apiPostForm<T>(path: string, formData: FormData): Promise<T> {
  return request<T>(path, { method: 'POST', body: formData });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
  });
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
  });
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}
