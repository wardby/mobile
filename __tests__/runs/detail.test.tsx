import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { Linking } from 'react-native';
import RunDetail from '../../app/runs/[id]';
import fixture from '../../src/api/__fixtures__/run-detail.json';
import graphFixture from '../../src/api/__fixtures__/graph.json';
import { ApiError } from '../../src/api/client';
import { session } from '../../src/auth/session';
import { useLiveGraph } from '../../src/live/useLiveGraph';
import type { components } from '../../src/api/schema';
import * as palette from '../../src/navigation/styles';

type Detail = components['schemas']['run-detail'];
const mockPush = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'run-coding' }),
  router: {
    push: (...args: unknown[]) => mockPush(...args),
    replace: (...args: unknown[]) => mockBack(...args),
    back: () => mockBack(),
    canGoBack: () => true,
  },
  Stack: { Screen: () => null },
}));
jest.mock('../../src/auth/session', () => ({ session: { apiClient: jest.fn() } }));
jest.mock('../../src/live/useLiveGraph', () => ({ useLiveGraph: jest.fn() }));
const getRun = jest.fn();
let detail: Detail;
let live: ReturnType<typeof useLiveGraph>;
const now = Date.parse('2026-10-01T10:07:12Z');
const setup = async () => render(<RunDetail />);
beforeEach(() => {
  jest.useFakeTimers({ now });
  jest.clearAllMocks();
  detail = {
    ...fixture,
    status: 'succeeded',
    finishedAt: new Date(now).toISOString(),
    finalText: 'one\ntwo\nthree\nfour\nfive\nsix\nseven',
    outcomes: [
      {
        kind: 'pull_request',
        provider: 'github',
        repository: 'team/project',
        number: 12,
        url: 'https://example.test/pr/12',
        state: 'open',
        at: null,
      },
    ],
  } as Detail;
  getRun.mockImplementation(async () => detail);
  (session.apiClient as jest.Mock).mockReturnValue({ getRun });
  live = {
    graph: { ...graphFixture, runs: [] } as components['schemas']['graph-snapshot'],
    status: 'live',
    lastUpdated: null,
    resyncVersion: 0,
    refresh: jest.fn(),
  } as ReturnType<typeof useLiveGraph>;
  (useLiveGraph as jest.Mock).mockImplementation(() => live);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('loads finished coding detail, all blocks, PR link and expandable plain result', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  await setup();
  expect(getRun).toHaveBeenCalledWith('run-coding');
  for (const id of [
    'status',
    'elapsed',
    'spend',
    'spend-bar',
    'tokens',
    'code',
    'outcomes',
    'subruns',
    'result',
  ])
    expect(screen.getByTestId(`run-detail-${id}`)).toBeTruthy();
  expect(screen.getByTestId('run-detail-elapsed')).toHaveTextContent(new RegExp('Took 7m 12s'));
  expect(screen.getByTestId('run-detail-code')).toHaveTextContent(new RegExp('team/project'));
  expect(screen.getByTestId('run-outcome-0')).toHaveProp(
    'accessibilityLabel',
    'Pull request 12, open, opens in browser',
  );
  await fireEvent.press(screen.getByTestId('run-outcome-0'));
  expect(open).toHaveBeenCalledWith(
    detail.outcomes[0].kind === 'pull_request' ? detail.outcomes[0].url : '',
  );
  expect(screen.getByTestId('run-detail-result')).toHaveTextContent(new RegExp('seven'));
  expect(screen.getByTestId('run-detail-result-viewport')).toHaveStyle({ maxHeight: 144 });
  await fireEvent(screen.getByTestId('run-detail-result-content'), 'layout', {
    nativeEvent: { layout: { height: 200 } },
  });
  await fireEvent.press(screen.getByTestId('run-detail-result-toggle'));
  expect(screen.getByTestId('run-detail-result-toggle')).toHaveProp('accessibilityState', {
    expanded: true,
  });
  expect(screen.getByTestId('run-detail-result')).toHaveTextContent(new RegExp('seven'));
  await fireEvent.press(screen.getByTestId('run-detail-result-toggle'));
  expect(screen.getByTestId('run-detail-result-viewport')).toHaveStyle({ maxHeight: 144 });
  expect(screen.getByTestId('run-detail-result-toggle')).toHaveProp('accessibilityState', {
    expanded: false,
  });
});

test('live fields and timer update without fetching; outcomes and resync refetch', async () => {
  detail = { ...detail, status: 'running', finishedAt: null, outcomes: [] };
  live.graph!.runs = [detail];
  const view = await setup();
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(screen.getByTestId('run-detail-elapsed')).toHaveTextContent(
    new RegExp('Running for 7m 13s'),
  );
  const changed = {
    ...detail,
    status: 'succeeded' as const,
    finishedAt: new Date(now + 1000).toISOString(),
    turns: 31,
    costUsd: 0.43,
  };
  live = { ...live, graph: { ...live.graph!, runs: [changed] } };
  await view.rerender(<RunDetail />);
  expect(screen.getByTestId('run-detail-status')).toHaveTextContent(new RegExp('Succeeded'));
  expect(screen.getByTestId('run-detail-spend')).toHaveTextContent(new RegExp('\\$0\\.43'));
  expect(screen.getByTestId('run-detail-tokens')).toHaveTextContent(new RegExp('31 turns'));
  await act(async () => {
    jest.advanceTimersByTime(1000);
  });
  expect(screen.getByTestId('run-detail-elapsed')).toHaveTextContent(new RegExp('Took 7m 13s'));
  expect(getRun).toHaveBeenCalledTimes(1);
  live = {
    ...live,
    graph: {
      ...live.graph!,
      runs: [
        {
          ...changed,
          outcomes: [
            { kind: 'issue_comment', provider: 'jira', issueKey: 'A-1', url: null, at: null },
          ],
        },
      ],
    },
  };
  await view.rerender(<RunDetail />);
  expect(getRun).toHaveBeenCalledTimes(2);
  live = { ...live, resyncVersion: 1 };
  await view.rerender(<RunDetail />);
  expect(getRun).toHaveBeenCalledTimes(3);
});

test.each([
  [2.5, 'running', '#34c759'],
  [4.25, 'running', '#ff9f0a'],
  [5, 'running', '#ff3b30'],
  [1, 'budget_exhausted', '#ff3b30'],
] as const)('spend bar %p %s', async (costUsd, status, backgroundColor) => {
  detail = { ...detail, costUsd, status };
  await setup();
  expect(screen.getByTestId('run-detail-spend-bar').props.children).toBeTruthy();
  expect(screen.getByTestId('run-detail-spend-bar').props.children.props.style).toEqual(
    expect.arrayContaining([expect.objectContaining({ backgroundColor })]),
  );
});

test('native run hides code, empty outcomes, children navigate, refresh fetches', async () => {
  detail = { ...detail, coding: null, outcomes: [] };
  live.graph!.runs = [{ ...detail, id: 'child', parentRunId: detail.id }];
  await setup();
  expect(screen.queryByTestId('run-detail-code')).toBeNull();
  expect(screen.getByText('No outcomes yet.')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('run-row-child'));
  expect(mockPush).toHaveBeenCalledWith('/runs/child');
  await act(async () => {
    await screen.getByTestId('run-detail').props.refreshControl.props.onRefresh();
  });
  expect(getRun).toHaveBeenCalledTimes(2);
});

test('failed run shows error; comments without URL and checks are text', async () => {
  detail = {
    ...detail,
    status: 'failed',
    error: 'Worker failed',
    outcomes: [
      { kind: 'issue_comment', provider: 'jira', issueKey: 'A-1', url: null, at: null },
      {
        kind: 'code_host_comment',
        provider: 'github',
        repository: 'team/project',
        number: 2,
        at: null,
      },
      {
        kind: 'check',
        provider: 'github',
        repository: 'team/project',
        number: 3,
        completed: true,
        at: null,
      },
    ],
  };
  await setup();
  expect(screen.getByTestId('run-detail-error')).toHaveTextContent(new RegExp('Worker failed'));
  for (const i of [0, 1, 2])
    expect(screen.getByTestId(`run-outcome-${i}`).props.onPress).toBeUndefined();
});

test('issue comment with URL opens browser', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  detail = {
    ...detail,
    outcomes: [
      {
        kind: 'issue_comment',
        provider: 'jira',
        issueKey: 'A-1',
        url: 'https://example.test/issue/A-1',
        at: null,
      },
    ],
  };
  await setup();
  await fireEvent.press(screen.getByTestId('run-outcome-0'));
  expect(open).toHaveBeenCalledWith('https://example.test/issue/A-1');
});

test('loading state', async () => {
  getRun.mockImplementation(() => new Promise(() => {}));
  await setup();
  expect(screen.getByTestId('run-detail-loading')).toHaveTextContent(new RegExp('Loading run…'));
});
test.each(['not_found', 'network_error'])('%s with back or retry', async (code) => {
  getRun.mockRejectedValue(new ApiError(404, code));
  await setup();
  if (code === 'not_found') {
    expect(screen.getByTestId('run-detail-not-found')).toHaveTextContent(
      /This run isn't available any more\./,
    );
    await fireEvent.press(screen.getByTestId('run-detail-back'));
    expect(mockBack).toHaveBeenCalled();
  } else {
    expect(screen.getByText("Couldn't load this run.")).toBeTruthy();
    getRun.mockResolvedValue(detail);
    await fireEvent.press(screen.getByTestId('run-detail-retry'));
    expect(getRun).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('run-detail')).toBeTruthy();
  }
});

test('outcomes arriving with the first live graph refetch stale detail', async () => {
  const withOutcome = detail;
  detail = { ...detail, outcomes: [] };
  live = { ...live, graph: null };
  const view = await setup();
  live = {
    ...live,
    graph: { ...graphFixture, runs: [withOutcome] } as components['schemas']['graph-snapshot'],
  };
  await view.rerender(<RunDetail />);
  expect(getRun).toHaveBeenCalledTimes(2);
});

test('outcome links visibly identify that they open outside the app', async () => {
  await setup();
  const outcome = screen.getByTestId('run-outcome-0');
  expect(outcome).not.toHaveTextContent(/›/);
  expect(outcome).toHaveProp('accessibilityHint', 'Opens in the browser');
});

test.each(['javascript:alert(1)', 'custom:run', 'https://', '/relative'])(
  'result renders unsafe link %s as plain text',
  async (href) => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    detail = { ...detail, finalText: `[Unsafe link](${href})` };
    await setup();
    const text = screen.getByText('Unsafe link');
    expect(text).toBeTruthy();
    expect(text.props.onPress).toBeUndefined();
    expect(screen.queryByRole('link', { name: 'Unsafe link, opens in browser' })).toBeNull();
    expect(open).not.toHaveBeenCalled();
  },
);

test.each(['http://example.test/docs', 'mailto:admin@example.test'])(
  'result opens safe link %s',
  async (href) => {
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    detail = { ...detail, finalText: `[Safe link](${href})` };
    await setup();
    await fireEvent.press(screen.getByTestId('markdown-link-result-0-0'));
    expect(open).toHaveBeenCalledWith(href);
  },
);

test.each(['light', 'dark'])(
  'result formats Markdown in %s, opens links externally and keeps images and HTML inert',
  async (mode) => {
    const color = mode === 'dark' ? '#ffffff' : '#000000';
    jest.spyOn(palette, 'useColors').mockReturnValue({
      background: mode === 'dark' ? '#121212' : '#ffffff',
      text: color,
      muted: '#888888',
      destructive: '#ff3b30',
      tint: mode === 'dark' ? '#66b2ff' : '#0066cc',
    });
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    detail = {
      ...detail,
      finalText:
        '# Summary\n\nA **bold** and *italic* result with `inline`.\n\n- First\n- Second\n\n3. Third\n4. Fourth\n\n> Quoted\n\n```ts\nconst result = 1;\n```\n\n[Read more](https://example.test/docs)\n\n![Chart](https://example.test/image.png)\n\n<div>Raw HTML</div>',
    };
    await setup();
    expect(screen.getByRole('header', { name: 'Summary' })).toHaveStyle({ color });
    expect(screen.getByText('bold')).toHaveStyle({ fontWeight: 'bold' });
    expect(screen.getByText('italic')).toHaveStyle({ fontStyle: 'italic' });
    expect(screen.getByText('inline')).toHaveStyle({ fontFamily: 'monospace' });
    expect(screen.getByTestId('run-detail-result')).toHaveTextContent(/• First/);
    expect(screen.getByTestId('run-detail-result')).toHaveTextContent(/3\. Third/);
    expect(screen.getByText('Quoted')).toBeTruthy();
    expect(screen.getByText('const result = 1;')).toHaveStyle({ fontFamily: 'monospace' });
    expect(screen.getByText('Chart')).toBeTruthy();
    expect(screen.container.queryAll((node) => /Image/.test(node.type))).toHaveLength(0);
    for (const node of screen.container.queryAll((node) => /Text/.test(node.type))) {
      expect(node.props.allowFontScaling).not.toBe(false);
    }
    expect(screen.getByText('<div>Raw HTML</div>')).toBeTruthy();
    const link = screen.getByRole('link', { name: 'Read more, opens in browser' });
    expect(link.props.testID).toBeTruthy();
    await fireEvent.press(link);
    expect(open).toHaveBeenCalledWith('https://example.test/docs');
    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByTestId('run-detail-result-toggle')).toBeNull();
  },
);
