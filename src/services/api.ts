const DEFAULT_TIMEOUT = 15000;

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions<TBody = unknown> {
  method?: HttpMethod;
  body?: TBody;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

export async function apiFetch<TResponse = unknown, TBody = unknown>(
  path: string,
  { method = 'GET', body, headers, signal }: RequestOptions<TBody> = {}
): Promise<TResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);

  const urlBase = process.env.EXPO_PUBLIC_API_URL ?? '';
  const url = urlBase ? `${urlBase.replace(/\/$/, '')}/${path.replace(/^\//, '')}` : path;

  try {
    const res = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: signal ?? controller.signal,
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return (await res.json()) as TResponse;
    }
    // @ts-expect-error allow text return for non-json
    return (await res.text()) as TResponse;
  } finally {
    clearTimeout(timeout);
  }
}

