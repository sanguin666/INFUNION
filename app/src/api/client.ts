import { Platform } from 'react-native';

// Expo inlines any EXPO_PUBLIC_* variable at build time (see app/.env.example).
// Defaults to localhost, which only works for the web target or a simulator
// on the same machine as the backend — a physical phone in Expo Go needs
// the dev machine's LAN IP here instead.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

/**
 * A file the backend stored, turned into something an <Image> can load.
 * Uploads come back as a relative path; anything already absolute (an
 * admin pasting a link) is left alone.
 */
export function uploadUri(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${API_BASE_URL}${path}`;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
    // The HTTP status, when there was a response at all — absent when the
    // request never reached the server. Lets a caller tell "you typed the
    // wrong thing" apart from "the backend is down".
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function readErrorMessage(response: Response): Promise<string | null> {
  try {
    const body = (await response.clone().json()) as { message?: string | string[] };
    if (Array.isArray(body.message)) return body.message[0] ?? null;
    return body.message ?? null;
  } catch {
    return null;
  }
}

/**
 * The signed-in congregant's token, mirrored here by AuthContext so every
 * call carries it without each api/ module having to thread it through.
 * Null when signed out, which is a normal state: reading content needs no
 * account, only posting does.
 */
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

// Called when the backend rejects the token — a week-old session, or one
// signed with a secret that has since changed. AuthContext registers a
// handler that signs the user out instead of leaving them stuck with a
// token every request will refuse.
let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

/**
 * A phone used without an account is known by its Expo push token alone
 * (Seb, 9 Nov 2026): set once it registers, sent only while nobody is
 * signed in, for the `/devices` notification routes.
 */
let deviceToken: string | null = null;

export function setDeviceToken(token: string | null): void {
  deviceToken = token;
}

export function isSignedIn(): boolean {
  return !!authToken;
}

function withAuth(init?: RequestInit): RequestInit | undefined {
  if (!authToken) {
    if (!deviceToken) return init;
    return { ...init, headers: { ...init?.headers, 'X-Push-Token': deviceToken } };
  }
  return {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${authToken}` },
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, withAuth(init));
  } catch (error) {
    throw new ApiError("Couldn't reach the server. Check your connection.", error);
  }

  // Only meaningful while we thought we were signed in: a 401 on a call
  // made with no token just means this route needs one.
  if (response.status === 401 && authToken) {
    onUnauthorized?.();
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new ApiError("We couldn't find that.", undefined, 404);
    }
    const serverMessage = await readErrorMessage(response);
    throw new ApiError(
      serverMessage ?? 'Something went wrong. Please try again.',
      undefined,
      response.status,
    );
  }

  // Read as text rather than `response.json()`: a 204, or any other
  // answer with no body, is a valid success and would otherwise throw on
  // an empty string. Callers expecting nothing are typed for it.
  const body = await response.text();
  return (body ? (JSON.parse(body) as T) : (undefined as T));
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path);
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function apiPut(path: string, body?: unknown): Promise<void> {
  await request<void>(
    path,
    body
      ? { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
      : { method: 'PUT' },
  );
}

export async function apiDelete(path: string): Promise<void> {
  await request<void>(path, { method: 'DELETE' });
}

// No Content-Type header here — fetch (or XMLHttpRequest) sets the
// multipart boundary itself when the body is a FormData instance.
export function apiPostForm<T>(path: string, formData: FormData): Promise<T> {
  if (Platform.OS === 'web') return request<T>(path, { method: 'POST', body: formData });
  return postFormNative<T>(path, formData);
}

/**
 * On a phone, files go up through React Native's own XMLHttpRequest.
 * The global fetch is Expo's (expo/fetch), and it refuses the
 * {uri, name, type} file parts React Native's FormData is built from
 * ("Unsupported FormDataPart implementation"), so every photo, voice
 * message and attachment failed before leaving the phone. XMLHttpRequest
 * still streams those parts from the file itself.
 */
function postFormNative<T>(path: string, formData: FormData): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE_URL}${path}`);
    if (authToken) xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
    xhr.onerror = () => reject(new ApiError("Couldn't reach the server. Check your connection."));
    xhr.ontimeout = xhr.onerror;
    xhr.onload = () => {
      const status = xhr.status;
      const text = typeof xhr.responseText === 'string' ? xhr.responseText : '';
      if (status === 401 && authToken) onUnauthorized?.();
      if (status < 200 || status >= 300) {
        if (status === 404) return reject(new ApiError("We couldn't find that.", undefined, 404));
        let serverMessage: string | null = null;
        try {
          const body = JSON.parse(text) as { message?: string | string[] };
          serverMessage = (Array.isArray(body.message) ? body.message[0] : body.message) ?? null;
        } catch {
          serverMessage = null;
        }
        return reject(new ApiError(serverMessage ?? 'Something went wrong. Please try again.', undefined, status));
      }
      try {
        resolve(text ? (JSON.parse(text) as T) : (undefined as T));
      } catch (error) {
        reject(new ApiError('Something went wrong. Please try again.', error, status));
      }
    };
    xhr.send(formData);
  });
}
