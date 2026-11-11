import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { session } from '../../src/auth/session';
import Spend from '../../app/(tabs)/spend';
import { createApiClient, ApiError } from '../../src/api/client';
import fixture from '../../src/api/__fixtures__/graph.json';
import type { Graph } from '../../src/spend/helpers';
import { theme } from '../../components/ui/theme';
let mockFocus: () => void;
const mockNavigate = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate }),
  useFocusEffect: (callback: () => void) => {
    const React = jest.requireActual('react');
    React.useEffect(() => {
      mockFocus = callback;
      return callback();
    }, [callback]);
  },
}));
jest.mock('../../src/auth/session', () => ({
  useSession: () => ({ status: 'signedIn', host: 'https://server.example' }),
  session: { getAccessToken: jest.fn(), signOut: jest.fn() },
}));
jest.mock('../../src/api/client', () => ({
  ...jest.requireActual('../../src/api/client'),
  createApiClient: jest.fn(),
}));
let getGraph: jest.Mock;
const now = new Date('2026-10-14T12:00:00Z');
const base = fixture.runs[0] as Graph['runs'][number];
const graph = (): Graph =>
  ({
    ...fixture,
    truncated: true,
    runs: Array.from({ length: 12 }, (_, i) => ({
      ...base,
      id: `r${i}`,
      parentRunId: null,
      agentId: `a${i}`,
      agentName: `Agent ${i}`,
      startedAt: now.toISOString(),
      costUsd: 1,
      outcomes: [],
      trigger: {
        kind: 'code_host',
        provider: 'github',
        repository: 'wardby/mobile',
        number: i + 1,
        event: 'mention',
      },
    })),
    spend: {
      todayUsd: 12,
      groups: [
        { id: 'cap', name: 'Capped', dailyBudgetUsd: 10, spentTodayUsd: 8 },
        { id: 'over', name: 'Over', dailyBudgetUsd: 10, spentTodayUsd: 10 },
        { id: 'ok', name: 'OK', dailyBudgetUsd: 10, spentTodayUsd: 1 },
        { id: 'none', name: 'Uncapped', dailyBudgetUsd: null, spentTodayUsd: 2.1 },
      ],
    },
  }) as Graph;
beforeEach(async () => {
  jest.useFakeTimers({ now });
  await AsyncStorage.clear();
  getGraph = jest.fn().mockResolvedValue(graph());
  (createApiClient as jest.Mock).mockReturnValue({ getGraph });
});
afterEach(() => jest.useRealTimers());
test('default week request, persisted switches, totals, truncation, budgets and refresh', async () => {
  await render(<Spend />);
  await waitFor(() =>
    expect(getGraph).toHaveBeenCalledWith({ since: '2026-10-12T00:00:00.000Z', limit: 2000 }),
  );
  expect(screen.getByTestId('spend-period-week')).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ selected: true }),
  );
  expect(screen.getByTestId('spend-total')).toHaveTextContent('≥ $12.00');
  expect(screen.getByText('12 runs this week')).toBeTruthy();
  expect(screen.getByTestId('spend-truncated')).toHaveTextContent(
    'Only the latest 2,000 runs are counted. Totals and breakdowns may be low.',
  );
  expect(screen.queryByTestId('spend-budget-cap')).toBeNull();
  await fireEvent.press(screen.getByTestId('spend-period-day'));
  await waitFor(() =>
    expect(getGraph).toHaveBeenLastCalledWith({ since: '2026-10-14T00:00:00.000Z', limit: 2000 }),
  );
  expect(await AsyncStorage.getItem('spend.period')).toBe('day');
  expect(screen.getByTestId('spend-budget-none')).toHaveTextContent('$2.10 today · no daily cap', {
    exact: false,
  });
  for (const [id, level] of [
    ['cap', 'warn'],
    ['over', 'over'],
    ['ok', 'ok'],
  ] as const)
    expect(screen.getByTestId(`spend-budget-${id}-bar-fill`)).toHaveStyle({
      backgroundColor: theme.light.progress[level],
    });
  await act(async () => {
    await screen.getByTestId('spend-scroll').props.refreshControl.props.onRefresh();
  });
  expect(getGraph).toHaveBeenCalledTimes(3);
  await fireEvent.press(screen.getByTestId('spend-period-month'));
  await waitFor(() =>
    expect(getGraph).toHaveBeenLastCalledWith({ since: '2026-10-01T00:00:00.000Z', limit: 2000 }),
  );
  expect(screen.queryByTestId('spend-budget-cap')).toBeNull();
});
test('links and issue/agent disclosures expand and collapse', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await render(<Spend />);
  await waitFor(() => expect(screen.getByTestId('spend-issue-more')).toBeTruthy());
  expect(screen.queryByTestId('spend-issue-code_host:github:wardby/mobile#9')).toBeNull();
  await fireEvent.press(screen.getByTestId('spend-issue-more'));
  await fireEvent.press(screen.getByTestId('spend-issue-code_host:github:wardby/mobile#9'));
  expect(open).toHaveBeenCalledWith('https://github.com/wardby/mobile/issues/9');
  await fireEvent.press(screen.getByTestId('spend-issue-fewer'));
  expect(screen.getByTestId('spend-issue-more')).toHaveTextContent(/Show 50 more/);
  await fireEvent.press(screen.getByTestId('spend-agent-more'));
  expect(screen.getByTestId('spend-agent-a9')).toBeTruthy();
  open.mockRestore();
});
test('loading, API error Retry, and empty', async () => {
  let resolve!: (value: Graph) => void;
  getGraph.mockReturnValueOnce(
    new Promise<Graph>((r) => {
      resolve = r;
    }),
  );
  await render(<Spend />);
  expect(screen.getByTestId('spend-loading')).toHaveTextContent('Loading spend…');
  await act(async () => resolve({ ...graph(), runs: [] }));
  expect(screen.getByTestId('spend-empty')).toHaveTextContent('No spend this week.');
  getGraph.mockRejectedValueOnce(new ApiError(0, 'network_error'));
  await act(async () => {
    await screen.getByTestId('spend-scroll').props.refreshControl.props.onRefresh();
  });
  expect(screen.getByTestId('spend-error')).toHaveTextContent("Couldn't load spend.", {
    exact: false,
  });
  await fireEvent.press(screen.getByTestId('spend-retry'));
  await waitFor(() => expect(screen.getByTestId('spend-total')).toBeTruthy());
  const options = (createApiClient as jest.Mock).mock.calls.at(-1)[0];
  options.onUnauthorized();
  expect(session.signOut).toHaveBeenCalled();
});
test('restores saved period across launches', async () => {
  await AsyncStorage.setItem('spend.period', 'month');
  const view = await render(<Spend />);
  await waitFor(() =>
    expect(getGraph).toHaveBeenCalledWith({ since: '2026-10-01T00:00:00.000Z', limit: 2000 }),
  );
  const calls = getGraph.mock.calls.length;
  await act(async () => {
    mockFocus();
  });
  expect(getGraph).toHaveBeenCalledTimes(calls + 1);
  await view.unmount();
  await render(<Spend />);
  await waitFor(() =>
    expect(screen.getByTestId('spend-period-month')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    ),
  );
});

test('agent spend row opens the Runs tab with the agent and navigation params', async () => {
  await render(<Spend />);
  const row = await screen.findByTestId('spend-agent-a0');
  expect(row).toHaveProp('accessibilityLabel', 'View runs by Agent 0');
  expect(row).toHaveTextContent(/›/);
  await fireEvent.press(row);
  expect(mockNavigate).toHaveBeenCalledWith({
    pathname: '/(tabs)',
    params: { agent: 'a0', agentNavigation: expect.any(String) },
  });
});

const large = (issues: number, agents: number, truncated = false): Graph => ({
  ...graph(),
  truncated,
  runs: Array.from({ length: Math.max(issues, agents) }, (_, i) => ({
    ...graph().runs[0],
    id: `r${i}`,
    agentId: `a${i % agents}`,
    agentName: `Agent ${i % agents}`,
    trigger: {
      ...graph().runs[0].trigger,
      number: (i % issues) + 1,
    } as Graph['runs'][number]['trigger'],
  })),
});
const issueRows = () => screen.queryAllByTestId(/^spend-issue-code_host:/).length;
const agentRows = () => screen.queryAllByTestId(/^spend-agent-a\d+$/).length;
test.each([
  ['issue', 120, 1, issueRows, [60, 110, 120]],
  ['agent', 1, 65, agentRows, [60, 65]],
] as const)(
  '%s list pages by 50, shows fewer, and resets on a period change',
  async (kind, issues, agents, rows, steps) => {
    getGraph.mockResolvedValue(large(issues, agents));
    const total = Math.max(issues, agents);
    await render(<Spend />);
    await waitFor(() => expect(rows()).toBe(10));
    expect(screen.queryByTestId(`spend-${kind}-fewer`)).toBeNull();
    const more = screen.getByTestId(`spend-${kind}-more`);
    expect(more).toHaveTextContent('Show 50 more');
    expect(more).toHaveProp('accessibilityLabel', `Show 50 more ${kind}s (${total} total)`);
    for (const step of steps) {
      await fireEvent.press(screen.getByTestId(`spend-${kind}-more`));
      expect(rows()).toBe(step);
    }
    expect(screen.queryByTestId(`spend-${kind}-more`)).toBeNull();
    const fewer = screen.getByTestId(`spend-${kind}-fewer`);
    expect(fewer).toHaveTextContent('Show fewer');
    expect(fewer).toHaveProp('accessibilityLabel', `Show only the top 10 ${kind}s`);
    await fireEvent.press(fewer);
    expect(rows()).toBe(10);
    expect(screen.queryByTestId(`spend-${kind}-fewer`)).toBeNull();
    await fireEvent.press(screen.getByTestId(`spend-${kind}-more`));
    expect(rows()).toBe(60);
    await fireEvent.press(screen.getByTestId('spend-period-month'));
    await waitFor(() =>
      expect(getGraph).toHaveBeenLastCalledWith({ since: '2026-10-01T00:00:00.000Z', limit: 2000 }),
    );
    await waitFor(() => expect(rows()).toBe(10));
    expect(screen.queryByTestId(`spend-${kind}-fewer`)).toBeNull();
  },
);
test('truncated graphs flag partial breakdowns', async () => {
  getGraph.mockResolvedValue(large(3, 3, true));
  const view = await render(<Spend />);
  expect(await screen.findByTestId('spend-truncated')).toHaveTextContent(
    'Only the latest 2,000 runs are counted. Totals and breakdowns may be low.',
  );
  expect(screen.getByTestId('spend-issue-partial')).toHaveTextContent('Partial');
  expect(screen.getByTestId('spend-agent-partial')).toHaveTextContent('Partial');
  await view.unmount();
  getGraph.mockResolvedValue(large(3, 3, false));
  await render(<Spend />);
  await waitFor(() => expect(screen.getByTestId('spend-total')).toHaveTextContent('$3.00'));
  expect(screen.queryByTestId('spend-truncated')).toBeNull();
  expect(screen.queryByTestId('spend-issue-partial')).toBeNull();
  expect(screen.queryByTestId('spend-agent-partial')).toBeNull();
});
test('renders 500 issues and 100 agents fully expanded', async () => {
  getGraph.mockResolvedValue(large(500, 100));
  await render(<Spend />);
  await waitFor(() => expect(issueRows()).toBe(10));
  for (let i = 0; i < 10 && screen.queryByTestId('spend-issue-more'); i++)
    await fireEvent.press(screen.getByTestId('spend-issue-more'));
  for (let i = 0; i < 2 && screen.queryByTestId('spend-agent-more'); i++)
    await fireEvent.press(screen.getByTestId('spend-agent-more'));
  expect(issueRows()).toBe(500);
  expect(agentRows()).toBe(100);
  expect(screen.getByTestId('spend-scroll')).toBeTruthy();
  expect(screen.getByTestId('spend-issue-unlinked')).toBeTruthy();
});
