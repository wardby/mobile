import type { paths } from './schema';

type GraphQuery = paths['/admin/api/graph']['get']['parameters']['query'];
type Graph = paths['/admin/api/graph']['get']['responses'][200]['content']['application/json'];
type Run = paths['/admin/api/runs/{id}']['get']['responses'][200]['content']['application/json'];
type Infra = paths['/admin/api/infra']['get']['responses'][200]['content']['application/json'];

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly requestId?: string,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}
export function createApiClient(options: {
  baseUrl: string;
  getAccessToken: () => string | null | Promise<string | null>;
  fetch?: typeof globalThis.fetch;
  onUnauthorized?: () => void;
}) {
  const fetch = options.fetch ?? globalThis.fetch;
  async function request<T>(path: string): Promise<T> {
    const token = await options.getAccessToken();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    let response: Response;
    try {
      response = await fetch(new URL(path, options.baseUrl).toString(), { method: 'GET', headers });
    } catch {
      throw new ApiError(0, 'network_error');
    }
    if (!response.ok) {
      if (response.status === 401) options.onUnauthorized?.();
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      const error = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
      const requestId =
        response.headers.get('x-request-id') ??
        (typeof error.id === 'string' ? error.id : undefined);
      throw new ApiError(
        response.status,
        typeof error.error === 'string' ? error.error : 'http_error',
        requestId,
      );
    }
    try {
      return (await response.json()) as T;
    } catch {
      throw new ApiError(0, 'network_error');
    }
  }
  return {
    getGraph(query: GraphQuery = {}): Promise<Graph> {
      const params = new URLSearchParams();
      if (query?.since !== undefined) params.set('since', query.since);
      if (query?.limit !== undefined) params.set('limit', String(query.limit));
      const search = params.toString();
      return request<Graph>(`/admin/api/graph${search ? '?' + search : ''}`);
    },
    getRun(id: string): Promise<Run> {
      return request<Run>(`/admin/api/runs/${encodeURIComponent(id)}`);
    },
    getInfra(): Promise<Infra> {
      return request<Infra>('/admin/api/infra');
    },
  };
}
