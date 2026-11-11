import AsyncStorage from '@react-native-async-storage/async-storage';
import { type TimeRange, isTimeRange } from '../runs/timeRange';
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
import { createStepStore, StepStoreProvider, type StepStore } from './stepStore';
import { stepFromEvent } from './steps';
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
  resyncVersion?: number;
  // Bumped after each graph load that follows a reconnect: events may be missed.
  loadVersion?: number;
  range?: TimeRange;
};
export type LiveGraphOptions = {
  baseUrl: string;
  getAccessToken: () => string | null | Promise<string | null>;
  client: {
    getGraph(query?: { since: string; limit: number }): Promise<Graph>;
    getRun(id: string): Promise<RunDetail>;
  };
  fetch?: StreamFetch;
  onUnauthorized?: () => void;
  random?: () => number;
  steps?: StepStore;
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
  const steps = options.steps ?? createStepStore();
  let state: LiveGraphState = {
    graph: null,
    status: 'connecting',
    lastUpdated: null,
    range: '24h',
  };
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
  let refreshPending = false;
  let missed = false;

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
    refreshPending = false;
    steps.pause();
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
    missed = true;
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
    if (buffered) {
      refreshPending = true;
      return;
    }
    const current = ++load;
    buffered = [];
    // Runs first seen during this load may be missing from its graph: keep them.
    const held = steps.runIds();
    let graph: Graph;
    try {
      graph = await options.client.getGraph({ since: state.range ?? '24h', limit: 500 });
    } catch {
      // Keep the last graph and retry with back-off; the reconnect refetches.
      if (current === load && running && !paused) reconnect();
      return;
    }
    if (current !== load) return;
    const events = buffered ?? [];
    buffered = null;
    if (missed) {
      missed = false;
      update({ graph, lastUpdated: new Date(), loadVersion: (state.loadVersion ?? 0) + 1 });
    } else update({ graph, lastUpdated: new Date() });
    steps.prune(
      graph.runs.map((run) => run.id),
      held,
    );
    events.forEach(apply);
    if (refreshPending) {
      refreshPending = false;
      void refresh();
    }
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
    } else if (frame.event === 'step') {
      // Steps live in their own store: never touch the graph or load it.
      const parsed = stepFromEvent(data);
      if (parsed) steps.merge(parsed.runId, [parsed.step]);
    } else if (frame.event === 'resync') {
      update({ resyncVersion: (state.resyncVersion ?? 0) + 1 });
      void refresh();
    } else if (frame.event === 'run' || frame.event === 'service' || frame.event === 'outcome') {
      const event = data as ViewerEvent;
      if (!state.graph?.runs.some((run) => run.id === event.runId)) {
        // Unknown rows need the complete graph shape. Coalesce requests without
        // invalidating the current load, and keep this event for replay too.
        void refresh();
      }
      if (buffered) buffered.push(event);
      else apply(event);
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
    missed = false;
    failures = 0;
    update({ status: 'connecting' });
    appState = AppState.addEventListener('change', (next) => {
      if (!running) return;
      if (next === 'background' && !paused) {
        paused = true;
        missed = true;
        disconnect();
      } else if (next === 'active' && paused) {
        paused = false;
        failures = 0;
        update({ status: 'connecting' });
        connect();
      }
    });
    void AsyncStorage.getItem('runs.timeRange')
      .catch(() => null)
      .then((saved) => {
        if (!running) return;
        if (isTimeRange(saved)) update({ range: saved });
        connect();
      });
  }
  function setRange(range: TimeRange) {
    if (range === state.range) return;
    load++;
    buffered = null;
    refreshPending = false;
    update({ range, graph: null });
    void AsyncStorage.setItem('runs.timeRange', range).catch(() => {});
    if (openedAt !== null) void refresh();
  }
  function close() {
    running = false;
    appState?.remove();
    appState = null;
    disconnect();
    steps.clear();
  }
  return {
    start,
    setRange,
    close,
    refresh,
    steps,
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
  return createElement(
    LiveGraphContext.Provider,
    { value: store },
    createElement(StepStoreProvider, { store: store?.steps ?? null }, children),
  );
}

export function useLiveGraph() {
  const store = useContext(LiveGraphContext);
  if (store === undefined) throw new Error('useLiveGraph must be used inside LiveGraphProvider');
  const state = useSyncExternalStore(
    store?.subscribe ?? noop,
    store?.getSnapshot ?? getIdle,
    store?.getSnapshot ?? getIdle,
  );
  return {
    ...state,
    range: state.range ?? '24h',
    setRange: store?.setRange ?? (() => {}),
    refresh: store?.refresh ?? refreshIdle,
  };
}
