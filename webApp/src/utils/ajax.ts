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
    body = JSON.stringify(options.params ?? {});
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

  if (!response.ok) {
    return {
      code: response.status,
      msg: response.statusText,
      data,
    };
  }

  return data ?? { code: response.status, data: null };
}
