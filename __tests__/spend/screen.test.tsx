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
    'Only the latest 2,000 runs are counted.',
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
  await fireEvent.press(screen.getByTestId('spend-issue-more'));
  expect(screen.getByTestId('spend-issue-more')).toHaveTextContent(/Show all \(12\)/);
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

test('agent spend row opens the Runs tab with only the agent param', async () => {
  await render(<Spend />);
  const row = await screen.findByTestId('spend-agent-a0');
  expect(row).toHaveProp('accessibilityLabel', 'View runs by Agent 0');
  expect(row).toHaveTextContent(/›/);
  await fireEvent.press(row);
  expect(mockNavigate).toHaveBeenCalledWith({ pathname: '/(tabs)', params: { agent: 'a0' } });
});
