import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { AppState } from 'react-native';
import { createApiClient } from '../api/client';
import type { components } from '../api/schema';
import { session, useSession } from '../auth/session';
import type { SseFrame } from './sse';
import { openEventStream, type StreamFetch } from './stream';

type Graph = components['schemas']['graph-snapshot'];
type Run = Graph['runs'][number];
type RunDetail = components['schemas']['run-detail'];
type ViewerEvent = components['schemas']['viewer-event'];

export type LiveStatus = 'connecting' | 'live' | 'reconnecting' | 'offline';
export type LiveGraphState = {
  graph: Graph | null;
  status: LiveStatus;
  lastUpdated: Date | null;
};
export type LiveGraphOptions = {
  baseUrl: string;
  getAccessToken: () => string | null | Promise<string | null>;
  client: { getGraph(): Promise<Graph>; getRun(id: string): Promise<RunDetail> };
  fetch?: StreamFetch;
  onUnauthorized?: () => void;
  random?: () => number;
};

const defaultRetry = 3000;
const maxDelay = 30000;
const stableAfter = 60000;
const maxRetries = 8;
const jitter = 0.2;

// Keeps the run graph current: open the stream, then load the graph, then
// apply events on top. Refetch on every resync and every reconnect.
export function createLiveGraph(options: LiveGraphOptions) {
  const random = options.random ?? Math.random;
  let state: LiveGraphState = { graph: null, status: 'connecting', lastUpdated: null };
  const listeners = new Set<() => void>();
  let controller: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let appState: { remove(): void } | null = null;
  let running = false;
  let paused = false;
  let failures = 0;
  let retry = defaultRetry;
  let openedAt: number | null = null;
  let load = 0;
  let buffered: ViewerEvent[] | null = null;

  const update = (next: Partial<LiveGraphState>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };
  function disconnect() {
    controller?.abort();
    controller = null;
    if (timer) clearTimeout(timer);
    timer = null;
    openedAt = null;
    load++;
    buffered = null;
  }
  function connect() {
    disconnect();
    const current = new AbortController();
    controller = current;
    void openEventStream({
      baseUrl: options.baseUrl,
      getAccessToken: options.getAccessToken,
      fetch: options.fetch,
      signal: current.signal,
      onOpen: () => {
        openedAt = Date.now();
        void refresh();
      },
      onFrame: handle,
      onRetry: (ms) => {
        retry = ms;
      },
      onError: () => {
        if (controller === current) reconnect();
      },
      onUnauthorized: () => {
        if (controller !== current) return;
        running = false;
        disconnect();
        update({ status: 'offline' });
        options.onUnauthorized?.();
      },
    });
  }
  function reconnect() {
    if (openedAt !== null && Date.now() - openedAt >= stableAfter) failures = 0;
    disconnect();
    if (failures >= maxRetries) {
      update({ status: 'offline' });
      return;
    }
    const delay = Math.min(maxDelay, retry * 2 ** failures);
    failures++;
    update({ status: 'reconnecting' });
    timer = setTimeout(connect, delay - delay * jitter * random());
  }
  async function refresh() {
    if (!running || paused) return;
    const current = ++load;
    buffered ??= [];
    let graph: Graph | null = null;
    try {
      graph = await options.client.getGraph();
    } catch {
      // Keep the last graph; events still apply on top of it.
    }
    if (current !== load) return;
    const events = buffered ?? [];
    buffered = null;
    if (graph) update({ graph, lastUpdated: new Date() });
    events.forEach(apply);
  }
  function handle(frame: SseFrame) {
    let data: unknown;
    try {
      data = JSON.parse(frame.data);
    } catch {
      return;
    }
    if (frame.event === 'hello' || frame.event === 'status') {
      const connected = (data as { connected?: unknown } | null)?.connected === true;
      update({ status: connected ? 'live' : 'reconnecting' });
    } else if (frame.event === 'resync') {
      void refresh();
    } else if (frame.event === 'run' || frame.event === 'service' || frame.event === 'outcome') {
      if (buffered) buffered.push(data as ViewerEvent);
      else apply(data as ViewerEvent);
    }
  }
  function replaceRun(id: string, change: (run: Run) => Run) {
    const graph = state.graph;
    const index = graph?.runs.findIndex((run) => run.id === id) ?? -1;
    if (!graph || index === -1) return false;
    const runs = [...graph.runs];
    runs[index] = change(runs[index]);
    update({ graph: { ...graph, runs }, lastUpdated: new Date() });
    return true;
  }
  function apply(event: ViewerEvent) {
    if (event.kind === 'run') {
      const { status, turns, tokensIn, tokensOut, costUsd, finishedAt } = event;
      replaceRun(event.runId, (run) => ({
        ...run,
        status,
        turns,
        tokensIn,
        tokensOut,
        costUsd,
        finishedAt,
      }));
    } else if (event.kind === 'service') {
      const known = state.graph?.runs
        .find((run) => run.id === event.runId)
        ?.services.some((service) => service.name === event.name);
      if (known)
        replaceRun(event.runId, (run) => ({
          ...run,
          services: run.services.map((service) =>
            service.name === event.name
              ? { ...service, state: event.state, attempts: event.attempts }
              : service,
          ),
        }));
      else if (state.graph?.runs.some((run) => run.id === event.runId))
        void refetchRun(event.runId);
    } else if (event.kind === 'outcome') {
      if (state.graph?.runs.some((run) => run.id === event.runId)) void refetchRun(event.runId);
    }
  }
  async function refetchRun(id: string) {
    const current = load;
    let detail: RunDetail;
    try {
      detail = await options.client.getRun(id);
    } catch {
      return;
    }
    if (current !== load || !running) return;
    // Keep the graph's shape: take only the fields a graph run has.
    replaceRun(id, (run) => {
      const merged: Record<string, unknown> = { ...run };
      for (const key of Object.keys(run))
        if (key in detail) merged[key] = detail[key as keyof RunDetail];
      return merged as Run;
    });
  }
  function start() {
    if (running) return;
    running = true;
    paused = false;
    failures = 0;
    update({ status: 'connecting' });
    appState = AppState.addEventListener('change', (next) => {
      if (!running) return;
      if (next === 'background' && !paused) {
        paused = true;
        disconnect();
      } else if (next === 'active' && paused) {
        paused = false;
        failures = 0;
        update({ status: 'connecting' });
        connect();
      }
    });
    connect();
  }
  function close() {
    running = false;
    appState?.remove();
    appState = null;
    disconnect();
  }
  return {
    start,
    close,
    refresh,
    getSnapshot: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
export type LiveGraph = ReturnType<typeof createLiveGraph>;

function sessionOptions(host: string): LiveGraphOptions {
  const onUnauthorized = () => {
    void session.signOut();
  };
  const getAccessToken = session.getAccessToken;
  return {
    baseUrl: host,
    getAccessToken,
    client: createApiClient({ baseUrl: host, getAccessToken, onUnauthorized }),
    onUnauthorized,
  };
}

const LiveGraphContext = createContext<LiveGraph | null | undefined>(undefined);
const idle: LiveGraphState = { graph: null, status: 'offline', lastUpdated: null };
const noop = () => () => {};
const getIdle = () => idle;
const refreshIdle = async () => {};

// One event stream per app, shared by every screen that calls useLiveGraph().
export function LiveGraphProvider({
  children,
  options,
}: {
  children: ReactNode;
  options?: LiveGraphOptions;
}) {
  const auth = useSession();
  const host = auth.status === 'signedIn' ? auth.host : null;
  const store = useMemo(
    () => (host ? createLiveGraph(options ?? sessionOptions(host)) : null),
    [host, options],
  );
  useEffect(() => {
    if (!store) return;
    store.start();
    return store.close;
  }, [store]);
  return createElement(LiveGraphContext.Provider, { value: store }, children);
}

export function useLiveGraph() {
  const store = useContext(LiveGraphContext);
  if (store === undefined) throw new Error('useLiveGraph must be used inside LiveGraphProvider');
  const state = useSyncExternalStore(
    store?.subscribe ?? noop,
    store?.getSnapshot ?? getIdle,
    store?.getSnapshot ?? getIdle,
  );
  return { ...state, refresh: store?.refresh ?? refreshIdle };
}
