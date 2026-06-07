/**
 * Minimal fetch wrapper used by the console UI.
 * - GET/DELETE: params are serialized as query-string (arrays expanded as repeated keys).
 * - POST/PUT/PATCH: params are JSON-stringified as the request body.
 * - Attaches the Bearer token from localStorage when present.
 * - Always resolves (never rejects on HTTP errors); non-2xx responses return a synthetic
 *   `{ code, msg, data }` envelope so callers can check `response.code`.
 */

export type AjaxOptions = {
  url: string;
  method?: string;
  params?: Record<string, any> | null;
  headers?: Record<string, string> | null;
};

const TOKEN_KEY = 'kudos_token';

function buildUrl(url: string, params?: Record<string, any> | null) {
  if (!params) return url;
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    if (Array.isArray(value)) {
      value.forEach((item) => query.append(key, String(item)));
    } else {
      query.append(key, String(value));
    }
  });
  const qs = query.toString();
  return qs ? `${url}${url.includes('?') ? '&' : '?'}${qs}` : url;
}

export async function ajax(options: AjaxOptions): Promise<any> {
  const method = (options.method || 'get').toUpperCase();
  const headers: Record<string, string> = {
    ...(options.headers || {}),
  };

  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let requestUrl = options.url;
  let body: string | undefined;

  if (method === 'GET' || method === 'DELETE') {
    requestUrl = buildUrl(requestUrl, options.params || undefined);
  } else if (options.params !== undefined) {
    headers['Content-Type'] = 'application/json';
    // options.params is guaranteed non-undefined here; null is a valid JSON value.
    body = JSON.stringify(options.params);
  }

  const response = await fetch(requestUrl, {
    method,
    headers,
    body,
  });

  const text = await response.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  // Non-2xx: return a synthetic envelope; callers inspect `result.code` rather than catching.
  if (!response.ok) {
    return {
      code: response.status,
      msg: response.statusText,
      data,
    };
  }

  return data ?? { code: response.status, data: null };
}
