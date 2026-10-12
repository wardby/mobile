import { fetch as expoFetch } from 'expo/fetch';
import { ApiError } from '../api/client';
import { SseParser, type SseFrame } from './sse';

type StreamReader = {
  read(): Promise<{ done: boolean; value?: Uint8Array }>;
  cancel(): Promise<void>;
};
export type StreamFetch = (
  url: string,
  init: { method: 'GET'; headers: Record<string, string>; signal: AbortSignal },
) => Promise<{ ok: boolean; status: number; body: { getReader(): StreamReader } | null }>;

// Opens GET /admin/api/events and feeds it to the SSE parser until it ends,
// fails or `signal` aborts. Resolves when the connection is over.
export async function openEventStream(options: {
  baseUrl: string;
  getAccessToken: () => string | null | Promise<string | null>;
  fetch?: StreamFetch;
  signal: AbortSignal;
  onFrame: (frame: SseFrame) => void;
  onOpen?: () => void;
  onError: (error: unknown) => void;
  onRetry?: (ms: number) => void;
  onUnauthorized?: () => void;
}): Promise<void> {
  const fetch = options.fetch ?? (expoFetch as StreamFetch);
  const { signal } = options;
  let reader: StreamReader | null = null;
  const cancel = () => {
    void reader?.cancel().catch(() => {});
  };
  signal.addEventListener('abort', cancel);
  try {
    const token = await options.getAccessToken();
    if (signal.aborted) return;
    // No token (e.g. a failed refresh) is a retryable error, not a 401.
    if (!token) throw new ApiError(0, 'no_token');
    const headers: Record<string, string> = {
      Accept: 'text/event-stream',
      Authorization: `Bearer ${token}`,
    };
    const response = await fetch(new URL('/admin/api/events', options.baseUrl).toString(), {
      method: 'GET',
      headers,
      signal,
    });
    if (signal.aborted) return;
    if (response.status === 401) {
      options.onUnauthorized?.();
      return;
    }
    if (!response.ok || !response.body) throw new ApiError(response.status, 'http_error');
    reader = response.body.getReader();
    options.onOpen?.();
    const decoder = new TextDecoder();
    const parser = new SseParser();
    let retry = parser.retry;
    for (;;) {
      const { done, value } = await reader.read();
      if (done || signal.aborted) break;
      const frames = parser.push(decoder.decode(value, { stream: true }));
      if (parser.retry !== undefined && parser.retry !== retry) {
        retry = parser.retry;
        options.onRetry?.(retry);
      }
      for (const frame of frames) {
        if (signal.aborted) return;
        options.onFrame(frame);
      }
    }
    if (!signal.aborted) options.onError(new ApiError(0, 'stream_ended'));
  } catch (error) {
    if (!signal.aborted) options.onError(error);
  } finally {
    signal.removeEventListener('abort', cancel);
  }
}
