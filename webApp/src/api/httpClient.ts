import { dispatchMockRequest, shouldUseMockBackend } from '../mocks/mockBackend';

const TOKEN_KEY = 'kudos_token';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export type HttpRequestOptions = {
  method?: HttpMethod | string;
  query?: Record<string, unknown> | null;
  body?: unknown;
  headers?: Record<string, string>;
  throwOnHttpError?: boolean;
};

/**
 * HTTP error that keeps the parsed response payload compatible with the existing
 * frontend error-recovery helpers.
 *
 * @author K
 * @author AI: Codex
 * @since 1.0.0
 */
export class HttpResponseError extends Error {
  readonly status: number;
  readonly data: unknown;
  readonly response: { status: number; data: unknown };

  constructor(status: number, data: unknown, fallbackMessage: string) {
    const message = extractMessage(data) ?? fallbackMessage;
    super(message);
    this.name = 'HttpResponseError';
    this.status = status;
    this.data = data;
    this.response = { status, data };
  }
}

/**
 * Browser token storage shared by authentication and all backend requests.
 *
 * @author K
 * @author AI: Codex
 * @since 1.0.0
 */
export class TokenStorage {
  static get(): string | null {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
  }

  static set(token: string): void {
    if (typeof localStorage !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
  }

  static clear(): void {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(TOKEN_KEY);
  }

  static has(): boolean {
    return Boolean(this.get());
  }
}

function apiBaseUrl(): string {
  if (typeof window === 'undefined') return '';
  const direct = (window as Window & { __KUDOS_API_BASE__?: string }).__KUDOS_API_BASE__;
  return (direct?.trim() || window.location.origin).replace(/\/$/, '');
}

function appendQuery(url: URL, query: Record<string, unknown> | null | undefined): void {
  if (!query) return;
  Object.entries(query).forEach(([key, value]) => appendQueryValue(url, key, value));
}

function appendQueryValue(url: URL, key: string, value: unknown): void {
  if (value === undefined) return;
  if (Array.isArray(value)) {
    value.forEach((item) => appendQueryValue(url, key, item));
    return;
  }
  if (value != null && typeof value === 'object') {
    url.searchParams.append(key, JSON.stringify(value));
    return;
  }
  url.searchParams.append(key, String(value));
}

function parseResponseBody(text: string): unknown {
  if (!text) return '';
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

function extractMessage(data: unknown): string | null {
  if (typeof data === 'string' && data.trim()) return data;
  if (data != null && typeof data === 'object' && !Array.isArray(data)) {
    const message = (data as Record<string, unknown>).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return null;
}

/**
 * Executes a browser request with the same URL, token and query conventions previously
 * used by the console's historical request layer.
 *
 * @author K
 * @author AI: Codex
 * @since 1.0.0
 */
export async function requestText(path: string, options: HttpRequestOptions = {}): Promise<string> {
  const method = String(options.method ?? 'GET').toUpperCase();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = new URL(`${apiBaseUrl()}${normalizedPath}`);
  appendQuery(url, options.query);

  const token = TokenStorage.get();
  const headers: Record<string, string> = { ...options.headers };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body !== undefined && !headers['Content-Type']) headers['Content-Type'] = 'application/json';

  let status: number;
  let text: string;
  if (shouldUseMockBackend()) {
    const mock = await dispatchMockRequest(url, { method, body: options.body, headers });
    status = mock.status;
    text = typeof mock.body === 'string' ? mock.body : JSON.stringify(mock.body);
  } else {
    const response = await fetch(url, {
      method,
      headers,
      credentials: 'same-origin',
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    status = response.status;
    text = await response.text();
  }

  if (options.throwOnHttpError && (status < 200 || status >= 300)) {
    throw new HttpResponseError(status, parseResponseBody(text), `HTTP ${status}`);
  }
  return text;
}

export async function requestJson<T>(path: string, options: HttpRequestOptions = {}): Promise<T> {
  const text = await requestText(path, { ...options, throwOnHttpError: true });
  return parseResponseBody(text) as T;
}
