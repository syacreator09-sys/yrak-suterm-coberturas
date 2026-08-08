import type { ApiFailureShape } from './types.js';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';
const DEV_EMAIL = import.meta.env.DEV
  ? import.meta.env.VITE_DEV_USER_EMAIL as string | undefined
  : undefined;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly correlationId?: string,
    public readonly details?: unknown,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

function requestHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers);
  if (DEV_EMAIL) headers.set('x-yrak-user-email', DEV_EMAIL);
  if (init.body && !(init.body instanceof FormData) && !headers.has('content-type')) {
    headers.set('content-type', 'application/json');
  }
  return headers;
}

async function parseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return null;
  const type = response.headers.get('content-type') ?? '';
  if (type.includes('application/json')) return response.json().catch(() => ({}));
  return response.text().catch(() => '');
}

export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: requestHeaders(init),
    credentials: 'same-origin',
  });
  const body = await parseBody(response);
  if (!response.ok) {
    const failure = (body && typeof body === 'object' ? body : {}) as ApiFailureShape;
    throw new ApiError(
      response.status,
      failure.error ?? failure.message ?? `HTTP_${response.status}`,
      response.headers.get('x-correlation-id') ?? undefined,
      body,
    );
  }
  return body as T;
}

export const api = {
  get<T>(path: string): Promise<T> {
    return request<T>(path);
  },
  post<T>(path: string, body?: unknown, init: RequestInit = {}): Promise<T> {
    return request<T>(path, {
      ...init,
      method: 'POST',
      ...(body === undefined ? {} : { body: body instanceof FormData ? body : JSON.stringify(body) }),
    });
  },
  put<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: 'PUT', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  },
  patch<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, { method: 'PATCH', ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  },
  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' });
  },
  upload<T>(path: string, form: FormData): Promise<T> {
    return request<T>(path, { method: 'POST', body: form });
  },
};

export { API_BASE_URL, DEV_EMAIL };
