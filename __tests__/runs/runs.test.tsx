import * as ThemeProvider from '../../components/ui/provider';
import { theme } from '../../components/ui/theme';
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
import Infra from '../../app/(tabs)/infra';
import Settings from '../../app/(tabs)/settings';
import RunDetail from '../../app/runs/[id]';
import mockDetailFixture from '../../src/api/__fixtures__/run-detail.json';
import graphFixture from '../../src/api/__fixtures__/graph.json';
import type { components } from '../../src/api/schema';
import { useSession } from '../../src/auth/session';
import { useLiveGraph, type LiveGraphState } from '../../src/live/useLiveGraph';
import { SseParser } from '../../src/live/sse';
import { createStepStore, StepStoreProvider, type StepStore } from '../../src/live/stepStore';
import { stepFromEvent, type Step } from '../../src/live/steps';
import stepEvents from '../fixtures/step-events.json';
import stepBurst from '../fixtures/step-burst.json';
import stepsOff from '../fixtures/events-steps-off.json';
import { fakeStepStore } from '../live/fakes';
import { statusStyle } from '../../src/runs/status';

type Graph = components['schemas']['graph-snapshot'];
type Run = Graph['runs'][number];

jest.mock('../../src/api/client', () => ({
  ...jest.requireActual('../../src/api/client'),
  createApiClient: () => ({
    getGraph: async () => jest.requireActual('../../src/api/__fixtures__/graph.json'),
  }),
}));
jest.mock('../../src/auth/session', () => ({
  useSession: jest.fn(),
  session: {
    apiClient: () => ({
      getRun: async (id: string) => ({ ...mockDetailFixture, id }),
      getInfra: async () => jest.requireActual('../../src/api/__fixtures__/infra.json'),
    }),
    getAccessToken: jest.fn(),
    signOut: jest.fn(),
  },
}));
jest.mock('../../src/live/useLiveGraph', () => ({
  useLiveGraph: jest.fn(),
  LiveGraphProvider: ({ children }: { children: ReactNode }) => children,
}));
// Counts row renders: RunRow formats its start time once per render.
const mockRowRenders: string[] = [];
jest.mock('../../src/runs/format', () => {
  const actual = jest.requireActual('../../src/runs/format');
  return {
    ...actual,
    relativeTime: (iso: string, now: number) => {
      mockRowRenders.push(iso);
      return actual.relativeTime(iso, now);
    },
  };
});
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
  '(tabs)/infra': Infra,
  '(tabs)/settings': Settings,
  'runs/[id]': RunDetail,
});
const app = (steps?: StepStore) => {
  const root = <ExpoRoot context={context} location={new URL('http://localhost/')} />;
  return steps ? <StepStoreProvider store={steps}>{root}</StepStoreProvider> : root;
};

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
    range: state.range ?? '24h',
    setRange: (range: LiveGraphState['range']) => {
      state = { ...state, range };
      listeners.forEach((listener) => listener());
    },
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
    run('fan-out', { status: 'succeeded', startedAt: minutes(23 * 60) }),
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
  expect(row).toHaveTextContent('mobile-deliveryRunning2m ago · $0.43 of $12 · 1 sub-run›');
  expect(row).toHaveProp(
    'accessibilityLabel',
    'mobile-delivery, Running, started 2m ago, cost $0.43',
  );
  expect(screen.getByTestId('run-row-nightly-report')).toHaveTextContent(
    'nightly-reportRunning1h ago · $0.021 of $1›',
  );
  expect(screen.getByTestId('run-row-triage-bot')).toHaveTextContent(
    'triage-botOut of budget3h ago · $2.98 of $3›',
  );
  expect(screen.getByTestId('run-row-fan-out')).toHaveTextContent(
    'fan-outSucceeded23h ago · $0.12 of $5 · 2 sub-runs›',
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
  await fireEvent.press(screen.getByTestId('runs-filter'));
  await fireEvent.press(screen.getByTestId(`runs-filter-${filter}`));
  await fireEvent.press(screen.getByTestId('runs-filter'));
  for (const name of ['all', 'running', 'failed'])
    expect(screen.getByTestId(`runs-filter-${name}`)).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: name === filter }),
    );
  await fireEvent.press(screen.getByTestId(`runs-filter-${filter}`));
  expect(rowIds()).toEqual(ids.map((id) => `run-row-${id}`));
};

test('All / Running / Failed filters show the right runs', async () => {
  state.graph = graphOf(
    everyStatus.map((status, i) => run(status, { status, startedAt: minutes(i) })),
  );
  await render(app());
  await fireEvent.press(screen.getByTestId('runs-filter'));
  expect(screen.getByTestId('runs-filter-all')).toHaveProp('accessibilityLabel', 'All');
  expect(screen.getByTestId('runs-filter-running')).toHaveProp('accessibilityLabel', 'Running');
  expect(screen.getByTestId('runs-filter-failed')).toHaveProp('accessibilityLabel', 'Failed');
  expect(screen.getByTestId('runs-filter-all')).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ selected: true }),
  );
  await fireEvent.press(screen.getByTestId('runs-filter-all'));
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
  expect(screen.getByTestId('spend-period-week')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('tab-infra'));
  expect(await screen.findByTestId('infra-coding-launcher')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('tab-runs'));
  await fireEvent.press(screen.getByTestId('runs-filter'));
  expect(screen.getByTestId('runs-filter-failed')).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ selected: true }),
  );
  await fireEvent.press(screen.getByTestId('runs-filter-failed'));
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
  ['live', 'Live', theme.light.progress.ok],
  ['reconnecting', 'Reconnecting', theme.light.progress.warn],
  ['connecting', 'Connecting', theme.light.progress.warn],
  ['offline', 'Offline', theme.light.offline],
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
  expect(screen.getByTestId('runs-empty')).toHaveTextContent('No runs in the last 24 hours.');
  await setLive({ graph: graphOf([run('done', { status: 'succeeded' })]) });
  await fireEvent.press(screen.getByTestId('runs-filter'));
  await fireEvent.press(screen.getByTestId('runs-filter-running'));
  expect(screen.getByTestId('runs-empty')).toHaveTextContent('Nothing running. (last 24 hours)');
  await fireEvent.press(screen.getByTestId('runs-filter'));
  await fireEvent.press(screen.getByTestId('runs-filter-failed'));
  expect(screen.getByTestId('runs-empty')).toHaveTextContent('No failures. 🎉 (last 24 hours)');
  await fireEvent.press(screen.getByTestId('runs-filter'));
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

test('screen root, rows, menus and refresh have stable testIDs and labels', async () => {
  state.graph = graphOf([run('alpha'), run('beta', { status: 'failed' })]);
  await render(app());
  expect(screen.getByTestId('screen-runs')).toBeTruthy();
  for (const id of ['alpha', 'beta'])
    expect(screen.getByTestId(`run-row-${id}`).props.accessibilityLabel).toMatch(
      new RegExp(`^${id}, `),
    );
  expect(screen.getByTestId('runs-agent')).toHaveProp('accessibilityLabel', 'Agent, All agents');
  expect(screen.getByTestId('runs-filter')).toHaveProp('accessibilityLabel', 'Status, All');
  expect(screen.getByTestId('runs-range').props.accessibilityLabel).toMatch(/^Time range, /);
  const control = screen.getByTestId('runs-list').props.refreshControl;
  expect(control.props.testID).toBe('runs-refresh');
  expect(control.props.accessibilityLabel).toBe('Refresh runs');
});

test('tapping a row opens the run detail', async () => {
  state.graph = graphOf([run('run-42')]);
  await render(app());
  await fireEvent.press(screen.getByTestId('run-row-run-42'));
  expect(screen.getByTestId('run-detail')).toBeTruthy();
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

test('shows the default range, range empty wording and selected status', async () => {
  jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue('light');
  await render(app());
  expect(screen.getByTestId('runs-range')).toHaveTextContent(/24h/);
  expect(screen.getByTestId('runs-empty')).toHaveTextContent('No runs in the last 24 hours.');
  expect(screen.getByTestId('runs-filter')).toHaveTextContent(/All/);
});
test('prunes rows at the selected window boundary without a request', async () => {
  state.graph = graphOf([run('aging', { startedAt: minutes(24 * 60 - 1) })]);
  await render(app());
  expect(rowIds()).toEqual(['run-row-aging']);
  await act(async () => {
    jest.advanceTimersByTime(60001);
  });
  expect(rowIds()).toEqual([]);
  expect(refresh).not.toHaveBeenCalled();
});
test('shows a muted footer when the graph is truncated', async () => {
  state.graph = { ...graphOf([run('one')]), truncated: true };
  await render(app());
  expect(screen.getByTestId('runs-limit')).toHaveTextContent(
    'Showing the latest 500 runs from the last 24 hours.',
  );
});
test('shows no footer when the graph is complete', async () => {
  state.graph = { ...graphOf([run('one')]), truncated: false };
  await render(app());
  expect(screen.getByTestId('run-row-one')).toBeTruthy();
  expect(screen.queryByTestId('runs-limit')).toBeNull();
});

test('expires a run between minute ticks at its exact window boundary', async () => {
  state.graph = graphOf([
    run('boundary', { startedAt: new Date(now - 86400000 + 30000).toISOString() }),
  ]);
  await render(app());
  await act(async () => {
    jest.advanceTimersByTime(30000);
  });
  expect(rowIds()).toEqual([]);
});

test.each(['light', 'dark'] as const)(
  'range menu marks its choice and widens the empty window in %s mode',
  async (mode) => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(mode);
    state.range = '1h';
    await render(app());
    expect(screen.getByTestId('runs-range')).toHaveProp(
      'accessibilityLabel',
      'Time range, last hour',
    );
    expect(screen.getByTestId('runs-empty')).toHaveTextContent('No runs in the last hour.');
    await fireEvent.press(screen.getByTestId('runs-range'));
    expect(screen.getByTestId('runs-range-1h')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByTestId('runs-range-1h')).toHaveTextContent(/✓ Last hour/);
    await fireEvent.press(screen.getByTestId('runs-range-6h'));
    expect(screen.getByTestId('runs-range')).toHaveTextContent(/6h/);
    await fireEvent.press(screen.getByTestId('runs-widen'));
    expect(screen.getByTestId('runs-range')).toHaveTextContent(/24h/);
    expect(screen.getByTestId('runs-filter')).toHaveTextContent(/All/);
  },
);

test('status menu marks the selected option', async () => {
  await render(app());
  for (const selected of ['all', 'running', 'failed']) await filtered(selected, []);
});

test('agent, status and range dropdowns combine and retain an empty agent', async () => {
  state.graph = graphOf([
    run('builder-failed', {
      agentId: 'builder',
      agentName: 'Builder',
      status: 'failed',
      startedAt: minutes(120),
    }),
    run('builder-running', { agentId: 'builder', agentName: 'Builder', startedAt: minutes(180) }),
    run('other', { agentId: 'other', agentName: 'Other' }),
    run('child', { agentId: 'builder', agentName: 'Builder', parentRunId: 'builder-failed' }),
  ]);
  await render(app());
  expect(
    screen.getAllByTestId(/^runs-(agent|filter|range)$/).map((item) => item.props.testID),
  ).toEqual(['runs-agent', 'runs-filter', 'runs-range']);
  expect(screen.getByTestId('runs-agent')).toHaveProp('accessibilityLabel', 'Agent, All agents');
  expect(screen.getByTestId('runs-filter')).toHaveProp('accessibilityLabel', 'Status, All');
  expect(screen.getByTestId('runs-range')).toHaveTextContent(/24h/);
  for (const id of ['runs-agent', 'runs-filter', 'runs-range'])
    expect(screen.getByTestId(id)).toHaveStyle({ minWidth: 44, minHeight: 44 });
  expect(screen.getByTestId('runs-filter')).toHaveStyle({ width: 104 });
  expect(screen.getByTestId('runs-range')).toHaveStyle({ width: 80 });
  expect(screen.getByTestId('runs-agent').props.className).toContain('flex-1 min-w-0');
  expect(within(screen.getByTestId('runs-agent')).getByText('All agents')).toHaveProp(
    'numberOfLines',
    1,
  );
  // At 320pt, fixed triggers, padding and gaps leave 88pt for the shrinking agent trigger.
  expect(320 - 104 - 80 - 32 - 16).toBeGreaterThanOrEqual(44);
  expect(rowIds()).toEqual(['run-row-other', 'run-row-builder-failed', 'run-row-builder-running']);
  await fireEvent.press(screen.getByTestId('runs-agent'));
  expect(screen.getByTestId('runs-agent-all')).toHaveTextContent(/All agents/);
  expect(screen.getByTestId('runs-agent-builder')).toHaveTextContent(/Builder · 2/);
  expect(screen.getByTestId('runs-agent-other')).toHaveTextContent(/Other · 1/);
  await fireEvent.press(screen.getByTestId('runs-agent-builder'));
  expect(rowIds()).toEqual(['run-row-builder-failed', 'run-row-builder-running']);
  await filtered('failed', ['builder-failed']);
  await fireEvent.press(screen.getByTestId('runs-range'));
  await fireEvent.press(screen.getByTestId('runs-range-1h'));
  expect(screen.getByTestId('runs-empty')).toHaveTextContent(
    'No failures. 🎉 (Builder, last hour)',
  );
  await filtered('all', []);
  expect(screen.getByTestId('runs-empty')).toHaveTextContent(
    'No runs by Builder in the last hour.',
  );
  expect(screen.getByTestId('runs-widen')).toBeTruthy();
  await setLive({ graph: graphOf([run('other', { agentId: 'other', agentName: 'Other' })]) });
  await fireEvent.press(screen.getByTestId('runs-agent'));
  expect(screen.getByTestId('runs-agent-builder')).toHaveTextContent('✓ Builder · 0');
  expect(screen.getByTestId('runs-agent-builder')).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ selected: true }),
  );
  await fireEvent.press(screen.getByTestId('runs-agent-all'));
  expect(rowIds()).toEqual(['run-row-other']);
});

test('route agent preselects, changes, and clears unknown or empty ids', async () => {
  state.graph = graphOf([
    run('one', { agentId: 'a', agentName: 'Agent A' }),
    run('two', { agentId: 'b', agentName: 'Agent B' }),
  ]);
  await render(<ExpoRoot context={context} location={new URL('http://localhost/?agent=a')} />);
  expect(rowIds()).toEqual(['run-row-one']);
  expect(screen.getByTestId('runs-agent')).toHaveTextContent(/Agent A/);
  await act(async () => router.navigate({ pathname: '/(tabs)', params: { agent: 'b' } }));
  expect(rowIds()).toEqual(['run-row-two']);
  await act(async () => router.setParams({ agent: 'unknown' }));
  expect(rowIds()).toEqual(['run-row-one', 'run-row-two']);
  await act(async () => router.setParams({ agent: '' }));
  expect(screen.getByTestId('runs-agent')).toHaveTextContent(/All agents/);
});

test.each(['builder', 'all'])(
  'repeated Spend agent taps replace a local %s selection',
  async (choice) => {
    state.graph = graphOf([
      graphFixture.runs[0] as Run,
      { ...graphFixture.runs[1], parentRunId: null } as Run,
    ]);
    await render(app());
    await act(async () => router.navigate('/(tabs)/spend'));
    await fireEvent.press(await screen.findByTestId('spend-agent-planner'));
    expect(screen.getByTestId('runs-agent')).toHaveTextContent(/Planner/);
    await fireEvent.press(screen.getByTestId('runs-agent'));
    await fireEvent.press(screen.getByTestId(`runs-agent-${choice}`));
    expect(screen.getByTestId('runs-agent')).toHaveTextContent(
      choice === 'all' ? /All agents/ : /Builder/,
    );
    await act(async () => router.navigate('/(tabs)/spend'));
    await fireEvent.press(await screen.findByTestId('spend-agent-planner'));
    expect(screen.getByTestId('runs-agent')).toHaveTextContent(/Planner/);
    expect(rowIds()).toEqual(['run-row-run-parent']);
  },
);

test.each(['light', 'dark'] as const)(
  'filter buttons highlight non-default choices and reset in %s mode',
  async (mode) => {
    jest.spyOn(ThemeProvider, 'useTheme').mockReturnValue(theme[mode]);
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(mode);
    state.graph = graphOf([run('builder', { agentId: 'builder', agentName: 'Builder' })]);
    await render(app());
    const colors = theme[mode];
    for (const [id, choice, defaultChoice] of [
      ['runs-agent', 'builder', 'all'],
      ['runs-filter', 'failed', 'all'],
      ['runs-range', '1h', '24h'],
    ]) {
      const label = () => within(screen.getByTestId(id)).getByText(/./);
      expect(screen.getByTestId(id).props.className.split(' ')).toEqual(
        expect.arrayContaining(['border', 'border-border', 'bg-fill', 'rounded-lg']),
      );
      expect(label()).toHaveStyle({ color: colors.text });
      await fireEvent.press(screen.getByTestId(id));
      await fireEvent.press(screen.getByTestId(id + '-' + choice));
      expect(screen.getByTestId(id).props.className.split(' ')).toContain('border-accent');
      expect(screen.getByTestId(id).props.className.split(' ')).not.toContain('border-border');
      expect(label()).toHaveStyle({ color: colors.tint });
      await fireEvent.press(screen.getByTestId(id));
      await fireEvent.press(screen.getByTestId(id + '-' + defaultChoice));
      expect(screen.getByTestId(id).props.className.split(' ')).toContain('border-border');
      expect(screen.getByTestId(id).props.className.split(' ')).not.toContain('border-accent');
      expect(label()).toHaveStyle({ color: colors.text });
    }
  },
);

const chainGraph = require('../../src/api/__fixtures__/graph-chains.json') as Graph;
const loadChains = () => {
  state.graph = { ...chainGraph, runs: chainGraph.runs.map((r) => ({ ...r })) };
};

test('chain heading, event details, singleton descendant ref and accessible labels', async () => {
  loadChains();
  await render(app());
  const heading = screen.getByTestId('run-group-wardby/wardby-mobile#64');
  expect(heading).toHaveTextContent(/wardby-mobile#64/);
  expect(heading).toHaveTextContent(/3 runs · \$1.84/);
  expect(heading).toHaveProp(
    'accessibilityLabel',
    'Pull request wardby-mobile#64, Running, 3 runs, $1.84, opens in browser',
  );
  expect(screen.getByTestId('run-group-state-wardby/wardby-mobile#64')).toHaveTextContent(
    'Running',
  );
  for (const [id, event] of [
    ['opened', 'opened'],
    ['review', 'review'],
    ['follow-up', 'follow-up'],
  ]) {
    expect(screen.getByTestId(`run-row-${id}`)).toHaveTextContent(new RegExp(`· ${event}`));
    expect(screen.getByTestId(`run-row-${id}`).props.accessibilityLabel).toMatch(
      new RegExp(`, ${event}$`),
    );
  }
  const singleton = screen.getByTestId('run-row-sub-builder');
  expect(singleton).toHaveTextContent(/· wardby#212 opened/);
  expect(singleton.props.className).toContain('h-16');
  expect(within(singleton).getByText(/wardby#212 opened/)).toHaveProp('numberOfLines', 1);
});
test('chain heading opens browser and grouped row opens detail', async () => {
  loadChains();
  const open = jest.spyOn(ReactNative.Linking, 'openURL').mockResolvedValue(undefined);
  await render(app());
  await fireEvent.press(screen.getByTestId('run-group-wardby/wardby-mobile#64'));
  expect(open).toHaveBeenCalledWith('https://github.com/wardby/wardby-mobile/pull/64');
  await fireEvent.press(screen.getByTestId('run-row-review'));
  expect(screen.getByTestId('run-detail')).toBeTruthy();
});
test('status filters keep whole chains, while agent and range filters precede grouping', async () => {
  loadChains();
  const issue = chainGraph.runs.find((r) => r.id === 'issue')!;
  state.graph!.runs.push({ ...issue, id: 'issue-failed', status: 'failed', startedAt: minutes(3) });
  await render(app());
  await filtered('failed', ['issue-failed', 'issue']);
  await filtered('running', ['follow-up', 'review', 'opened']);
  await fireEvent.press(screen.getByTestId('runs-agent'));
  await fireEvent.press(screen.getByTestId('runs-agent-builder'));
  expect(screen.getByTestId('run-group-wardby/wardby-mobile#64')).toHaveTextContent(
    /2 runs · \$1.53/,
  );
  await filtered('all', ['follow-up', 'opened']);
  await fireEvent.press(screen.getByTestId('runs-agent'));
  await fireEvent.press(screen.getByTestId('runs-agent-reviewer'));
  expect(screen.queryByTestId('run-group-wardby/wardby-mobile#64')).toBeNull();
  expect(screen.getByTestId('run-row-review')).toHaveTextContent(/wardby-mobile#64 review/);
  await fireEvent.press(screen.getByTestId('runs-agent'));
  await fireEvent.press(screen.getByTestId('runs-agent-all'));
  await fireEvent.press(screen.getByTestId('runs-range'));
  await fireEvent.press(screen.getByTestId('runs-range-1h'));
  expect(screen.getByTestId('run-group-wardby/wardby-mobile#64')).toHaveTextContent(
    /2 runs · \$0.71/,
  );
});

test('issue headings without URLs are headers and live updates change chain state', async () => {
  const issue = chainGraph.runs.find((r) => r.id === 'issue')!;
  const trigger: Run['trigger'] = {
    kind: 'issue',
    provider: 'linear',
    issueKey: 'MOB-7',
    url: null,
  };
  state.graph = graphOf([
    { ...issue, trigger },
    { ...issue, id: 'issue-2', trigger, status: 'running', startedAt: minutes(2) },
  ]);
  await render(app());
  const heading = screen.getByTestId('run-group-issue:MOB-7');
  expect(heading).toHaveProp('accessibilityRole', 'header');
  expect(heading).toHaveProp('accessibilityLabel', 'Issue MOB-7, Running, 2 runs, $0.24');
  expect(heading.props.onPress).toBeUndefined();
  await setLive({ graph: graphOf(state.graph!.runs.map((r) => ({ ...r, status: 'succeeded' }))) });
  expect(screen.getByTestId('run-group-state-issue:MOB-7')).toHaveTextContent('Done');
});

// The step frames of a recorded stream, as [runId, steps] pairs for store.merge.
const stepFrames = (stream: string, runId?: string) =>
  new SseParser()
    .push(stream)
    .filter((frame) => frame.event === 'step')
    .map((frame) => stepFromEvent(JSON.parse(frame.data))!)
    .map((parsed): [string, Step[]] => [runId ?? parsed.runId, [parsed.step]]);
const [pending, succeeded, said] = stepFrames(stepEvents.stream);
const rowLabels = () =>
  screen.queryAllByTestId(/^run-row-/).map((row) => row.props.accessibilityLabel);

test('a running run shows its latest step in place of started and cost', async () => {
  const steps = fakeStepStore();
  steps.merge(...pending);
  steps.merge(...succeeded);
  steps.merge(...stepFrames(stepEvents.stream, 'done')[1]);
  state.graph = graphOf([
    run('run-coding'),
    run('idle', { startedAt: minutes(10) }),
    run('done', { status: 'succeeded', startedAt: minutes(20) }),
  ]);
  await render(app(steps));
  const row = screen.getByTestId('run-row-run-coding');
  expect(row).toHaveTextContent('run-codingRunning✓ Bash: npm test›');
  expect(row).toHaveProp(
    'accessibilityLabel',
    'run-coding, Running, started 5m ago, cost $0.12, now: Bash: npm test, succeeded',
  );
  expect(row.props.className).toContain('h-16');
  expect(screen.getByTestId('run-latest-step-run-coding')).toHaveProp('numberOfLines', 1);
  expect(screen.getByTestId('run-row-idle')).toHaveTextContent('idleRunning10m ago · $0.12 of $5›');
  expect(screen.getByTestId('run-row-done')).toHaveTextContent(
    'doneSucceeded20m ago · $0.12 of $5›',
  );
  expect(screen.getByTestId('run-row-done')).toHaveProp(
    'accessibilityLabel',
    'done, Succeeded, started 20m ago, cost $0.12',
  );

  await act(async () => steps.merge(...said));
  expect(row).toHaveTextContent('run-codingRunning"Tests pass; opening the pull request."›');
  expect(row.props.accessibilityLabel).toBe(
    'run-coding, Running, started 5m ago, cost $0.12, now: Agent said: Tests pass; opening the pull request.',
  );
  expect(row.props.accessibilityLabel).not.toMatch(/[✓✕…┃]/);

  await setLive({ graph: graphOf([run('run-coding', { status: 'succeeded' })]) });
  expect(screen.getByTestId('run-row-run-coding')).toHaveTextContent(
    'run-codingSucceeded5m ago · $0.12 of $5›',
  );
  expect(screen.getByTestId('run-row-run-coding')).toHaveProp(
    'accessibilityLabel',
    'run-coding, Succeeded, started 5m ago, cost $0.12',
  );
  expect(screen.queryByTestId('run-latest-step-run-coding')).toBeNull();
});

test('a long step stays on one truncated line and the row keeps 64 pt', async () => {
  const steps = fakeStepStore();
  const [runId, [step]] = succeeded;
  steps.merge(runId, [{ ...step, summary: 'npm test -- --watch=false '.repeat(20) }]);
  state.graph = graphOf([run('run-coding')]);
  await render(app(steps));
  expect(screen.getByTestId('run-row-run-coding').props.className).toContain('h-16');
  const line = screen.getByTestId('run-latest-step-run-coding');
  expect(line).toHaveProp('numberOfLines', 1);
  expect(line).toHaveProp('ellipsizeMode', 'tail');
});

test('rows inside PR chain groups show their latest step too', async () => {
  loadChains();
  const steps = fakeStepStore();
  steps.merge(...stepFrames(stepEvents.stream, 'follow-up')[1]);
  await render(app(steps));
  expect(screen.getByTestId('run-group-wardby/wardby-mobile#64')).toHaveProp(
    'accessibilityLabel',
    'Pull request wardby-mobile#64, Running, 3 runs, $1.84, opens in browser',
  );
  const row = screen.getByTestId('run-row-follow-up');
  expect(row).toHaveTextContent(/✓ Bash: npm test›$/);
  expect(row.props.accessibilityLabel).toMatch(/, follow-up, now: Bash: npm test, succeeded$/);
  expect(screen.getByTestId('run-row-review')).toHaveTextContent(/· review/);
});

test('a burst of step events re-renders only that row, once per flush window', async () => {
  const steps = createStepStore({ flushMs: 500 });
  state.graph = graphOf([run('run-coding'), run('other', { startedAt: minutes(10) })]);
  await render(app(steps));
  const coding = state.graph.runs[0].startedAt;
  const other = state.graph.runs[1].startedAt;
  mockRowRenders.length = 0;
  await act(async () => {
    for (const frame of stepFrames(stepBurst.stream)) steps.merge(...frame);
  });
  expect(mockRowRenders).toEqual([]);
  await act(async () => {
    jest.advanceTimersByTime(500);
  });
  expect(mockRowRenders.filter((iso) => iso === coding)).toHaveLength(1);
  expect(mockRowRenders.filter((iso) => iso === other)).toHaveLength(0);
  expect(screen.getByTestId('run-row-run-coding')).toHaveTextContent(
    /✓ Bash: npm test -- step 200›$/,
  );
});

test.each([
  ['no step store', () => undefined],
  ['an empty step store', () => fakeStepStore()],
  ['a steps-off stream', () => fakeStepStore(stepsOff.stream)],
])('with %s every row is exactly as without steps', async (_, steps) => {
  state.graph = graphOf(graphFixture.runs.map((r) => ({ ...(r as Run), parentRunId: null })));
  await render(app(steps()));
  expect(rowLabels()).toEqual([
    'Planner, Running, started 2h ago, cost $0.12',
    'Builder, Running, started 2h ago, cost $0.12',
    'Planner, Succeeded, started 2h ago, cost $0.12',
  ]);
  expect(screen.queryAllByTestId(/^run-latest-step-/)).toEqual([]);
  for (const row of screen.queryAllByTestId(/^run-row-/))
    expect(row).toHaveTextContent(/^(Planner|Builder)(Running|Succeeded)2h ago · \$0.12 of \$5›$/);
});

test('at fontScale 2 and 320 pt the step line stays one truncated line in a 64 pt row', async () => {
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
    width: 320,
    height: 568,
    scale: 2,
    fontScale: 2,
  });
  const steps = fakeStepStore();
  const [runId, [step]] = succeeded;
  steps.merge(runId, [
    { ...step, status: 'exit 127', summary: 'npm test -- --watch=false '.repeat(20) },
  ]);
  steps.merge(...stepFrames(stepEvents.stream, 'idle')[2]);
  state.graph = graphOf([run('run-coding'), run('idle', { startedAt: minutes(10) })]);
  await render(app(steps));
  for (const id of ['run-coding', 'idle']) {
    const row = screen.getByTestId(`run-row-${id}`);
    expect(row.props.className.split(' ')).toContain('h-16');
    expect(row.props.accessibilityLabel).not.toMatch(/[✓✕…┃]/);
    const line = screen.getByTestId(`run-latest-step-${id}`);
    expect(line).toHaveProp('numberOfLines', 1);
    expect(line).toHaveProp('ellipsizeMode', 'tail');
    expect(line.parent?.props.className).toContain('flex-1 min-w-0');
  }
  expect(screen.getByTestId('run-row-run-coding').props.accessibilityLabel).toMatch(
    /, now: Bash: (npm test -- --watch=false )+, exited with code 127$/,
  );
  expect(screen.getByTestId('run-latest-step-run-coding')).toHaveTextContent(/^exit 127 Bash:/);
});
