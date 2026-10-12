import { act, render, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { AppState, Text, type AppStateStatus } from 'react-native';
import graphFixture from '../../src/api/__fixtures__/graph.json';
import runFixture from '../../src/api/__fixtures__/run-detail.json';
import type { components } from '../../src/api/schema';
import { useSession } from '../../src/auth/session';
import {
  LiveGraphProvider,
  useLiveGraph,
  type LiveGraphOptions,
} from '../../src/live/useLiveGraph';
import { baseUrl, fakeStream, flush, type FakeStream } from './fakes';

type Graph = components['schemas']['graph-snapshot'];
type RunDetail = components['schemas']['run-detail'];

jest.mock('../../src/auth/session', () => ({ useSession: jest.fn() }));

let auth: { status: string; host: string | null };
let log: string[];
let streams: FakeStream[];
let signals: AbortSignal[];
let fetch: jest.Mock;
let options: LiveGraphOptions;
let appState: (state: AppStateStatus) => void;
const graph = () => structuredClone(graphFixture) as Graph;
const run = (id: string, value: Graph) => value.runs.find((r) => r.id === id)!;
const frame = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
const runEvent = {
  kind: 'run',
  runId: 'run-coding',
  parentRunId: 'run-parent',
  agentId: 'builder',
  status: 'succeeded',
  turns: 7,
  tokensIn: 5000,
  tokensOut: 900,
  costUsd: 0.5,
  finishedAt: '2026-10-01T10:05:00.000Z',
};
const latest = () => streams[streams.length - 1];
const settle = () => act(flush);
const advance = (ms: number) =>
  act(async () => {
    jest.advanceTimersByTime(ms);
    await flush();
  });

beforeEach(() => {
  jest.useFakeTimers();
  auth = { status: 'signedIn', host: baseUrl };
  (useSession as jest.Mock).mockImplementation(() => auth);
  log = [];
  streams = [];
  signals = [];
  fetch = jest.fn(async (_url: string, init: { signal: AbortSignal }) => {
    log.push('stream');
    signals.push(init.signal);
    const stream = fakeStream();
    streams.push(stream);
    return { ok: true, status: 200, body: stream.body };
  });
  options = {
    baseUrl,
    getAccessToken: () => 'fake-token',
    fetch,
    client: {
      getGraph: jest.fn(async () => {
        log.push('graph');
        return graph();
      }),
      getRun: jest.fn(async () => structuredClone(runFixture) as RunDetail),
    },
    onUnauthorized: jest.fn(),
    random: () => 0,
  };
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appState = listener as (state: AppStateStatus) => void;
    return { remove: jest.fn() } as never;
  });
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function mount() {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <LiveGraphProvider options={options}>{children}</LiveGraphProvider>
  );
  const hook = await renderHook(() => useLiveGraph(), { wrapper });
  await settle();
  return hook;
}
async function live() {
  const hook = await mount();
  latest().push(frame('hello', { connected: true }));
  await settle();
  return hook;
}

test('opens the stream before loading the graph', async () => {
  let open: (value: unknown) => void = () => {};
  const stream = fakeStream();
  fetch.mockImplementationOnce(() => {
    log.push('stream');
    return new Promise((resolve) => (open = resolve));
  });
  const { result } = await mount();
  expect(result.current.status).toBe('connecting');
  expect(options.client.getGraph).not.toHaveBeenCalled();
  open({ ok: true, status: 200, body: stream.body });
  await settle();
  expect(log).toEqual(['stream', 'graph']);
  expect(result.current.graph).toEqual(graphFixture);
  expect(result.current.lastUpdated).toBeInstanceOf(Date);
});
test('a run event updates that run and events for unknown runs are ignored', async () => {
  const { result } = await live();
  latest().push(`id: 1\n${frame('run', runEvent)}`);
  latest().push(frame('run', { ...runEvent, runId: 'run-unknown' }));
  await settle();
  const updated = run('run-coding', result.current.graph!);
  expect(updated).toEqual({
    ...run('run-coding', graph()),
    ...runEvent,
    kind: undefined,
    runId: undefined,
  });
  expect(run('run-parent', result.current.graph!)).toEqual(run('run-parent', graph()));
  expect(result.current.graph!.runs).toHaveLength(graph().runs.length);
});
test('a service event updates that service', async () => {
  const { result } = await live();
  latest().push(
    frame('service', {
      kind: 'service',
      runId: 'run-coding',
      name: 'postgres',
      state: 'failed',
      attempts: 3,
    }),
  );
  await settle();
  expect(run('run-coding', result.current.graph!).services[0]).toEqual({
    ...run('run-coding', graph()).services[0],
    state: 'failed',
    attempts: 3,
  });
});
test('an outcome event refetches that run and merges it', async () => {
  const outcome = { kind: 'pull_request', provider: 'github', repository: 'team/project' };
  (options.client.getRun as jest.Mock).mockResolvedValueOnce({
    ...structuredClone(runFixture),
    status: 'succeeded',
    outcomes: [outcome],
  });
  const { result } = await live();
  latest().push(frame('outcome', { kind: 'outcome', runId: 'run-coding', source: 'pull_request' }));
  await settle();
  expect(options.client.getRun).toHaveBeenCalledWith('run-coding');
  const merged = run('run-coding', result.current.graph!);
  expect(merged.status).toBe('succeeded');
  expect(merged.outcomes).toEqual([outcome]);
  expect(merged).not.toHaveProperty('coding');
});
test('resync refetches and replaces the graph', async () => {
  const { result } = await live();
  const next = { ...graph(), runs: [run('run-parent', graph())] };
  (options.client.getGraph as jest.Mock).mockResolvedValueOnce(next);
  latest().push(frame('resync', {}));
  await settle();
  expect(options.client.getGraph).toHaveBeenCalledTimes(2);
  expect(result.current.graph).toEqual(next);
});
test('a failed graph load reconnects with back-off and loads the graph again', async () => {
  (options.client.getGraph as jest.Mock).mockRejectedValueOnce(new TypeError('Network failed'));
  const { result } = await live();
  expect(result.current.graph).toBeNull();
  expect(result.current.status).toBe('reconnecting');
  expect(signals[0].aborted).toBe(true);
  await advance(2999);
  expect(fetch).toHaveBeenCalledTimes(1);
  await advance(1);
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(options.client.getGraph).toHaveBeenCalledTimes(2);
  expect(result.current.graph).toEqual(graphFixture);
});
test('hello false then status true gives reconnecting then live', async () => {
  const { result } = await mount();
  latest().push(frame('hello', { connected: false }));
  await settle();
  expect(result.current.status).toBe('reconnecting');
  latest().push(frame('status', { connected: true }));
  await settle();
  expect(result.current.status).toBe('live');
  latest().push(frame('status', { connected: false }));
  await settle();
  expect(result.current.status).toBe('reconnecting');
});
test('a drop reconnects with capped exponential back-off, then refetches the graph', async () => {
  const { result } = await live();
  fetch.mockImplementation(async () => {
    log.push('stream');
    throw new TypeError('Network request failed');
  });
  latest().end();
  await settle();
  expect(result.current.status).toBe('reconnecting');
  for (const delay of [3000, 6000, 12000, 24000, 30000, 30000]) {
    const calls = fetch.mock.calls.length;
    await advance(delay - 1);
    expect(fetch).toHaveBeenCalledTimes(calls);
    await advance(1);
    expect(fetch).toHaveBeenCalledTimes(calls + 1);
    expect(result.current.status).toBe('reconnecting');
  }
  fetch.mockImplementation(async () => {
    log.push('stream');
    const stream = fakeStream();
    streams.push(stream);
    return { ok: true, status: 200, body: stream.body };
  });
  await advance(30000);
  expect(log.slice(-2)).toEqual(['stream', 'graph']);
  latest().push(frame('hello', { connected: true }));
  await settle();
  expect(result.current.status).toBe('live');
});
test('back-off starts at the server retry value and adds jitter', async () => {
  options.random = () => 0.5;
  await mount();
  latest().push('retry: 1000\n\n');
  await settle();
  latest().end();
  await settle();
  await advance(899);
  expect(fetch).toHaveBeenCalledTimes(1);
  await advance(1);
  expect(fetch).toHaveBeenCalledTimes(2);
});
test('goes offline after the retry limit', async () => {
  const { result } = await live();
  fetch.mockRejectedValue(new TypeError('Network request failed'));
  latest().end();
  await settle();
  for (let i = 0; i < 20; i++) await advance(30000);
  expect(result.current.status).toBe('offline');
  expect(fetch).toHaveBeenCalledTimes(1 + 8);
  for (let i = 0; i < 20; i++) await advance(30000);
  expect(fetch).toHaveBeenCalledTimes(1 + 8);
});
test('the back-off resets after a stable connection', async () => {
  await live();
  latest().end();
  await settle();
  await advance(3000);
  expect(fetch).toHaveBeenCalledTimes(2);
  // A short connection keeps doubling.
  await advance(1000);
  latest().end();
  await settle();
  await advance(5999);
  expect(fetch).toHaveBeenCalledTimes(2);
  await advance(1);
  expect(fetch).toHaveBeenCalledTimes(3);
  // A connection that stays up for 60 s starts again at 3 s.
  await advance(60000);
  latest().end();
  await settle();
  await advance(3000);
  expect(fetch).toHaveBeenCalledTimes(4);
});
test('background closes the stream and foreground reopens it and refetches', async () => {
  await live();
  await act(async () => appState('background'));
  expect(signals[0].aborted).toBe(true);
  expect(streams[0].cancelled).toBe(true);
  await advance(60000);
  expect(fetch).toHaveBeenCalledTimes(1);
  await act(async () => appState('active'));
  await settle();
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(log).toEqual(['stream', 'graph', 'stream', 'graph']);
});
test('unmount closes the stream', async () => {
  const { unmount } = await live();
  await act(async () => unmount());
  expect(signals[0].aborted).toBe(true);
  await advance(60000);
  expect(fetch).toHaveBeenCalledTimes(1);
});
test('sign-out closes the stream', async () => {
  const { rerender } = await live();
  auth = { status: 'signedOut', host: null };
  await rerender({});
  await settle();
  expect(signals[0].aborted).toBe(true);
  await advance(60000);
  expect(fetch).toHaveBeenCalledTimes(1);
});
test('a 401 signs out without reconnecting', async () => {
  fetch.mockResolvedValueOnce({ ok: false, status: 401, body: null });
  const { result } = await mount();
  expect(options.onUnauthorized).toHaveBeenCalledTimes(1);
  await advance(10 * 60 * 1000);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(options.client.getGraph).not.toHaveBeenCalled();
  expect(result.current.status).toBe('offline');
});
test('refresh refetches the graph', async () => {
  const { result } = await live();
  await act(() => result.current.refresh());
  expect(options.client.getGraph).toHaveBeenCalledTimes(2);
  expect(fetch).toHaveBeenCalledTimes(1);
});
test('two screens share one stream', async () => {
  const Screen = ({ testID }: { testID: string }) => (
    <Text testID={testID}>{useLiveGraph().status}</Text>
  );
  const screen = await render(
    <LiveGraphProvider options={options}>
      <Screen testID="first" />
      <Screen testID="second" />
    </LiveGraphProvider>,
  );
  await settle();
  latest().push(frame('hello', { connected: true }));
  await settle();
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('first')).toHaveTextContent('live');
  expect(screen.getByTestId('second')).toHaveTextContent('live');
});
test('useLiveGraph outside the provider throws a clear error', async () => {
  jest.spyOn(console, 'error').mockImplementation(() => {});
  await expect(renderHook(() => useLiveGraph())).rejects.toThrow(
    'useLiveGraph must be used inside LiveGraphProvider',
  );
});

test('resync notifies detail subscribers even when graph runs are unchanged', async () => {
  const hook = await live();
  const before = hook.result.current.resyncVersion ?? 0;
  latest().push(frame('resync', {}));
  await settle();
  expect(hook.result.current.resyncVersion).toBe(before + 1);
});
