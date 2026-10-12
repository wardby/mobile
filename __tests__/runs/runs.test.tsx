import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { ExpoRoot, router } from 'expo-router';
import { getMockContext } from 'expo-router/testing-library';
import { useSyncExternalStore, type ReactNode } from 'react';
import * as ReactNative from 'react-native';
import RootLayout from '../../app/_layout';
import Connect from '../../app/connect';
import TabsLayout from '../../app/(tabs)/_layout';
import Runs from '../../app/(tabs)/index';
import Spend from '../../app/(tabs)/spend';
import Settings from '../../app/(tabs)/settings';
import RunDetail from '../../app/runs/[id]';
import graphFixture from '../../src/api/__fixtures__/graph.json';
import type { components } from '../../src/api/schema';
import { useSession } from '../../src/auth/session';
import { useLiveGraph, type LiveGraphState } from '../../src/live/useLiveGraph';
import { statusStyle } from '../../src/runs/status';

type Graph = components['schemas']['graph-snapshot'];
type Run = Graph['runs'][number];

jest.mock('../../src/auth/session', () => ({
  useSession: jest.fn(),
  session: { getAccessToken: jest.fn(), signOut: jest.fn() },
}));
jest.mock('../../src/live/useLiveGraph', () => ({
  useLiveGraph: jest.fn(),
  LiveGraphProvider: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

const context = getMockContext({
  _layout: RootLayout,
  connect: Connect,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': Runs,
  '(tabs)/spend': Spend,
  '(tabs)/settings': Settings,
  'runs/[id]': RunDetail,
});
const app = () => <ExpoRoot context={context} location={new URL('http://localhost/')} />;

const now = Date.parse('2026-10-01T12:00:00.000Z');
const minutes = (n: number) => new Date(now - n * 60000).toISOString();
const base = graphFixture.runs[0] as Run;
const run = (id: string, overrides: Partial<Run> = {}): Run => ({
  ...base,
  id,
  parentRunId: null,
  agentName: id,
  startedAt: minutes(5),
  ...overrides,
});
const graphOf = (runs: Run[]): Graph => ({ ...(graphFixture as Graph), runs });

// A mocked useLiveGraph() backed by a tiny store, so tests can push live updates.
let state: LiveGraphState;
let refresh: jest.Mock;
const listeners = new Set<() => void>();
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const setLive = (next: Partial<LiveGraphState>) =>
  act(() => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  });
const rowIds = () => screen.queryAllByTestId(/^run-row-/).map((row) => row.props.testID);

beforeEach(() => {
  jest.useFakeTimers({ now });
  listeners.clear();
  refresh = jest.fn(async () => {});
  state = { graph: graphOf([]), status: 'live', lastUpdated: null };
  (useLiveGraph as jest.Mock).mockImplementation(() => ({
    ...useSyncExternalStore(subscribe, () => state),
    refresh,
  }));
  (useSession as jest.Mock).mockImplementation(() => ({
    ready: true,
    status: 'signedIn',
    host: 'https://server.example',
    error: null,
    signIn: jest.fn(),
    signOut: jest.fn(),
    clearError: jest.fn(),
  }));
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('shows top-level runs only, newest first, with sub-run counts', async () => {
  state.graph = graphOf([
    run('nightly-report', { startedAt: minutes(60), costUsd: 0.021, budgetUsd: 1 }),
    run('child-a', { parentRunId: 'mobile-delivery', startedAt: minutes(1) }),
    run('mobile-delivery', { startedAt: minutes(2), costUsd: 0.43, budgetUsd: 12 }),
    run('grandchild', { parentRunId: 'child-a', startedAt: minutes(1) }),
    run('triage-bot', {
      status: 'budget_exhausted',
      startedAt: minutes(180),
      costUsd: 2.98,
      budgetUsd: 3,
    }),
    run('fan-out', { status: 'succeeded', startedAt: minutes(30 * 60) }),
    run('child-b', { parentRunId: 'fan-out' }),
    run('child-c', { parentRunId: 'fan-out' }),
  ]);
  await render(app());
  expect(screen.getByTestId('runs-list')).toBeTruthy();
  expect(rowIds()).toEqual([
    'run-row-mobile-delivery',
    'run-row-nightly-report',
    'run-row-triage-bot',
    'run-row-fan-out',
  ]);
  const row = screen.getByTestId('run-row-mobile-delivery');
  expect(row).toHaveTextContent('mobile-deliveryRunning2m ago · $0.43 of $12 · 1 sub-run');
  expect(row).toHaveProp(
    'accessibilityLabel',
    'mobile-delivery, Running, started 2m ago, cost $0.43',
  );
  expect(screen.getByTestId('run-row-nightly-report')).toHaveTextContent(
    'nightly-reportRunning1h ago · $0.021 of $1',
  );
  expect(screen.getByTestId('run-row-triage-bot')).toHaveTextContent(
    'triage-botOut of budget3h ago · $2.98 of $3',
  );
  expect(screen.getByTestId('run-row-fan-out')).toHaveTextContent(
    'fan-outSucceeded1d ago · $0.12 of $5 · 2 sub-runs',
  );
});

const everyStatus: Run['status'][] = [
  'pending',
  'running',
  'succeeded',
  'failed',
  'refused',
  'lost',
  'budget_exhausted',
  'cancelled',
];
const filtered = async (filter: string, ids: string[]) => {
  await fireEvent.press(screen.getByTestId(`runs-filter-${filter}`));
  for (const name of ['all', 'running', 'failed'])
    expect(screen.getByTestId(`runs-filter-${name}`)).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: name === filter }),
    );
  expect(rowIds()).toEqual(ids.map((id) => `run-row-${id}`));
};

test('All / Running / Failed filters show the right runs', async () => {
  state.graph = graphOf(
    everyStatus.map((status, i) => run(status, { status, startedAt: minutes(i) })),
  );
  await render(app());
  expect(screen.getByTestId('runs-filter-all')).toHaveProp('accessibilityLabel', 'All');
  expect(screen.getByTestId('runs-filter-running')).toHaveProp('accessibilityLabel', 'Running');
  expect(screen.getByTestId('runs-filter-failed')).toHaveProp('accessibilityLabel', 'Failed');
  expect(screen.getByTestId('runs-filter-all')).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ selected: true }),
  );
  expect(rowIds()).toEqual(everyStatus.map((id) => `run-row-${id}`));
  await filtered('running', ['pending', 'running']);
  await filtered('failed', ['failed', 'refused', 'lost', 'budget_exhausted']);
  await filtered('all', everyStatus);
});

test('the selected filter survives a tab switch', async () => {
  state.graph = graphOf([run('busy'), run('broken', { status: 'failed' })]);
  await render(app());
  await filtered('failed', ['broken']);
  await fireEvent.press(screen.getByTestId('tab-spend'));
  expect(screen.getByTestId('spend-placeholder')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('tab-runs'));
  expect(screen.getByTestId('runs-filter-failed')).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ selected: true }),
  );
  expect(rowIds()).toEqual(['run-row-broken']);
});

const pills: [Run['status'], string, string][] = [
  ['running', 'Running', 'blue'],
  ['pending', 'Queued', 'blue'],
  ['succeeded', 'Succeeded', 'green'],
  ['failed', 'Failed', 'red'],
  ['lost', 'Lost', 'red'],
  ['budget_exhausted', 'Out of budget', 'orange'],
  ['refused', 'Refused', 'orange'],
  ['cancelled', 'Cancelled', 'grey'],
];
describe.each(['light', 'dark'] as const)('in %s mode', (mode) => {
  test.each(pills)('%s renders the %p pill in %s', async (status, label, tone) => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(mode);
    const style = statusStyle(status);
    expect(style.label).toBe(label);
    expect(style.tone).toBe(tone);
    state.graph = graphOf([run('one', { status })]);
    await render(app());
    const pill = screen.getByTestId('run-status-one');
    expect(pill).toHaveStyle({ backgroundColor: style[mode].background });
    expect(within(pill).getByText(label)).toHaveStyle({ color: style[mode].text });
    expect(screen.getByTestId('run-row-one')).toHaveProp(
      'accessibilityLabel',
      `one, ${label}, started 5m ago, cost $0.12`,
    );
  });
});

test('pill colours come from one table, with separate light and dark colours', () => {
  const byTone = new Map<string, ReturnType<typeof statusStyle>>();
  for (const [status, , tone] of pills) {
    const style = statusStyle(status);
    expect(style.light).not.toEqual(style.dark);
    const same = byTone.get(tone);
    if (same) expect([style.light, style.dark]).toEqual([same.light, same.dark]);
    byTone.set(tone, style);
  }
  expect(new Set([...byTone.values()].map((style) => style.light.background)).size).toBe(5);
});

test.each([
  ['live', 'Live', '#34c759'],
  ['reconnecting', 'Reconnecting', '#ff9f0a'],
  ['connecting', 'Connecting', '#ff9f0a'],
  ['offline', 'Offline', '#8e8e93'],
] as const)('live indicator for %s shows %p with a %s dot', async (status, label, color) => {
  state.status = status;
  await render(app());
  const indicator = screen.getByTestId('runs-live-indicator');
  expect(indicator).toHaveProp('accessibilityLabel', label);
  expect(indicator).toHaveTextContent(label);
  expect(within(indicator).getByTestId('runs-live-dot')).toHaveStyle({ backgroundColor: color });
});

test('shows a spinner while the first graph loads', async () => {
  state = { graph: null, status: 'connecting', lastUpdated: null };
  await render(app());
  expect(screen.getByTestId('runs-loading')).toHaveTextContent('Loading runs…');
  expect(screen.queryByTestId('runs-list')).toBeNull();
  await setLive({ graph: graphOf([run('first')]), status: 'live' });
  expect(screen.queryByTestId('runs-loading')).toBeNull();
  expect(rowIds()).toEqual(['run-row-first']);
});

test('each filter has its own empty state', async () => {
  await render(app());
  expect(screen.getByTestId('runs-empty')).toHaveTextContent('No runs in the last day.');
  await setLive({ graph: graphOf([run('done', { status: 'succeeded' })]) });
  await fireEvent.press(screen.getByTestId('runs-filter-running'));
  expect(screen.getByTestId('runs-empty')).toHaveTextContent('Nothing running.');
  await fireEvent.press(screen.getByTestId('runs-filter-failed'));
  expect(screen.getByTestId('runs-empty')).toHaveTextContent('No failures. 🎉');
  await fireEvent.press(screen.getByTestId('runs-filter-all'));
  expect(screen.queryByTestId('runs-empty')).toBeNull();
});

test('pull to refresh calls refresh()', async () => {
  state.graph = graphOf([run('one')]);
  await render(app());
  const control = screen.getByTestId('runs-list').props.refreshControl;
  expect(control.props.refreshing).toBe(false);
  await act(async () => {
    await control.props.onRefresh();
  });
  expect(refresh).toHaveBeenCalledTimes(1);
});

test('tapping a row opens the run detail placeholder', async () => {
  state.graph = graphOf([run('run-42')]);
  await render(app());
  await fireEvent.press(screen.getByTestId('run-row-run-42'));
  expect(screen.getByTestId('run-detail-placeholder')).toHaveTextContent(
    'run-42Run detail coming soon.',
  );
  expect(router.canGoBack()).toBe(true);
});

test('a live update changes the row status', async () => {
  state.graph = graphOf([run('one'), run('two', { startedAt: minutes(10) })]);
  await render(app());
  expect(screen.getByTestId('run-status-one')).toHaveTextContent('Running');
  await setLive({ graph: graphOf([run('one', { status: 'failed' }), run('two')]) });
  expect(screen.getByTestId('run-status-one')).toHaveTextContent('Failed');
  expect(screen.getByTestId('run-row-one')).toHaveProp(
    'accessibilityLabel',
    'one, Failed, started 5m ago, cost $0.12',
  );
});

test('relative start times move on as the clock ticks', async () => {
  state.graph = graphOf([run('one')]);
  await render(app());
  expect(screen.getByTestId('run-row-one')).toHaveTextContent(/^one.*5m ago/);
  await act(async () => {
    jest.advanceTimersByTime(2 * 60000);
  });
  expect(screen.getByTestId('run-row-one')).toHaveTextContent(/^one.*7m ago/);
});
