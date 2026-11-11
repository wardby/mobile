import { theme } from '../../components/ui/theme';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { Profiler, type ReactNode } from 'react';
import { Linking } from 'react-native';
import RunDetail from '../../app/runs/[id]';
import fixture from '../../src/api/__fixtures__/run-detail.json';
import stepsOff from '../../src/api/__fixtures__/run-detail-steps-off.json';
import pre09 from '../../src/api/__fixtures__/run-detail-pre-0.9.json';
import dropped from '../../src/api/__fixtures__/run-detail-dropped.json';
import many from '../../src/api/__fixtures__/run-detail-many.json';
import events from '../fixtures/step-events.json';
import { fakeStepStore } from '../live/fakes';
import { StepStoreProvider, type StepStore } from '../../src/live/stepStore';
import type { Step } from '../../src/live/steps';
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
let store: StepStore;
let renders = 0;
const now = Date.parse('2026-10-01T10:07:12Z');
const wrapper = ({ children }: { children: ReactNode }) => (
  <StepStoreProvider store={store}>
    <Profiler id="run-detail" onRender={() => renders++}>
      {children}
    </Profiler>
  </StepStoreProvider>
);
const setup = async () => render(<RunDetail />, { wrapper });
beforeEach(() => {
  store = fakeStepStore();
  renders = 0;
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
    range: '24h',
    setRange: jest.fn(),
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
    disabled: false,
    expanded: true,
  });
  expect(screen.getByTestId('run-detail-result')).toHaveTextContent(new RegExp('seven'));
  await fireEvent.press(screen.getByTestId('run-detail-result-toggle'));
  expect(screen.getByTestId('run-detail-result-viewport')).toHaveStyle({ maxHeight: 144 });
  expect(screen.getByTestId('run-detail-result-toggle')).toHaveProp('accessibilityState', {
    disabled: false,
    expanded: false,
  });
});

test('run detail content is inset below the translucent iOS header', async () => {
  await setup();
  expect(screen.getByTestId('run-detail')).toHaveProp(
    'contentInsetAdjustmentBehavior',
    'automatic',
  );
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
  ['running', true],
  ['pending', true],
  ['succeeded', false],
] as const)('a loadVersion change refetches a %s run: %p', async (status, refetches) => {
  detail = {
    ...detail,
    status,
    finishedAt: status === 'succeeded' ? detail.finishedAt : null,
    outcomes: [],
  };
  live.graph!.runs = [detail];
  live = { ...live, loadVersion: 0 };
  const view = await setup();
  expect(getRun).toHaveBeenCalledTimes(1);
  live = { ...live, loadVersion: 1 };
  await view.rerender(<RunDetail />);
  expect(getRun).toHaveBeenCalledTimes(refetches ? 2 : 1);
});

test.each([
  [2.5, 'running', theme.light.progress.ok],
  [4.25, 'running', theme.light.progress.warn],
  [5, 'running', theme.light.progress.over],
  [1, 'budget_exhausted', theme.light.progress.over],
] as const)('spend bar %p %s', async (costUsd, status, backgroundColor) => {
  detail = { ...detail, costUsd, status };
  await setup();
  expect(screen.getByTestId('run-detail-spend-bar').props.children).toBeTruthy();
  expect(screen.getByTestId('run-detail-spend-bar-fill')).toHaveStyle({ backgroundColor });
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
      fill: theme[mode === 'dark' ? 'dark' : 'light'].fill,
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

test.each([
  ['tight', '\n'],
  ['loose', '\n\n'],
])('result renders %s task lists as read-only checkboxes', async (_kind, separator) => {
  detail = {
    ...detail,
    finalText: ['- [x] Done item', '- [ ] Open item', '- Plain item'].join(separator),
  };
  await setup();
  const checked = screen.getByTestId('markdown-task-result-0-0');
  expect(checked).toHaveProp('accessibilityRole', 'checkbox');
  expect(checked).toHaveProp('accessibilityState', { checked: true, disabled: true });
  const unchecked = screen.getByTestId('markdown-task-result-0-1');
  expect(unchecked).toHaveProp('accessibilityRole', 'checkbox');
  expect(unchecked).toHaveProp('accessibilityState', { checked: false, disabled: true });
  expect(screen.queryByTestId('markdown-task-result-0-2')).toBeNull();
  const result = screen.getByTestId('run-detail-result');
  expect(result).toHaveTextContent(/• Plain item/);
  expect(result).toHaveTextContent(/Done item/);
  expect(result).toHaveTextContent(/Open item/);
  expect(result).not.toHaveTextContent(/\[x\]|\[ \]/);
});

test('result toggle uses an accent disclosure with a 44pt target and pressed feedback', async () => {
  await setup();
  await fireEvent(screen.getByTestId('run-detail-result-content'), 'layout', {
    nativeEvent: { layout: { height: 200 } },
  });
  const toggle = screen.getByTestId('run-detail-result-toggle');
  expect(toggle).toHaveStyle({ minHeight: 44, minWidth: 44 });
  expect(screen.getByText('Show more')).toHaveStyle({ color: theme.light.tint });
  expect(toggle).toHaveTextContent(/▾/);
  expect(toggle).toHaveProp('accessibilityState', { disabled: false, expanded: false });
  const event = { persist: jest.fn(), nativeEvent: { pageX: 0, pageY: 0 } };
  await fireEvent(toggle, 'responderGrant', event);
  expect(toggle).toHaveStyle({ opacity: 0.6 });
  await fireEvent(toggle, 'responderTerminate', event);
  await waitFor(() => expect(toggle).toHaveStyle({ opacity: 1 }));
  await fireEvent.press(toggle);
  expect(toggle).toHaveProp('accessibilityLabel', 'Show less');
  expect(toggle).toHaveTextContent(/▴/);
  expect(toggle).toHaveProp('accessibilityState', { disabled: false, expanded: true });
  expect(screen.getByText('Show less')).toHaveStyle({ color: theme.light.tint });
  await fireEvent.press(toggle);
  expect(toggle).toHaveProp('accessibilityLabel', 'Show more');
  expect(toggle).toHaveTextContent(/▾/);
  expect(toggle).toHaveProp('accessibilityState', { disabled: false, expanded: false });
});

test.each([theme.light.tint, theme.dark.tint])(
  'inline markdown link uses accent %s and pressed feedback',
  async (tint) => {
    jest.spyOn(palette, 'useColors').mockReturnValue({
      background: '#ffffff',
      fill: theme.light.fill,
      text: '#000000',
      muted: '#888888',
      destructive: '#ff3b30',
      tint,
    });
    const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    detail = { ...detail, finalText: 'See [**Read more**](https://example.test/docs) here.' };
    await setup();
    const link = screen.getByTestId('markdown-link-result-0-1');
    expect(link).toHaveStyle({ color: tint });
    expect(link).toHaveTextContent(/Read more ↗/);
    expect(link).toHaveProp('accessibilityRole', 'link');
    expect(link).toHaveProp('accessibilityHint', 'Opens in the browser');
    await fireEvent(link, 'pressIn');
    expect(link).toHaveStyle({ opacity: 0.6 });
    await fireEvent(link, 'pressOut');
    expect(link).toHaveStyle({ opacity: 1 });
    await fireEvent.press(link);
    expect(open).toHaveBeenCalledWith('https://example.test/docs');
  },
);

const running = () => ({ ...fixture, status: 'running', finishedAt: null }) as Detail;
const testIds = (root: string, pattern: RegExp) =>
  within(screen.getByTestId(root))
    .queryAllByTestId(pattern)
    .map((node) => node.props.testID as string);
const stepIds = () => testIds('run-detail-steps', /^run-step-\d+$/);
const liveSteps = fakeStepStore(events.stream);
const mergeEvents = () =>
  act(async () => {
    for (const runId of liveSteps.runIds()) store.merge(runId, liveSteps.getSteps(runId));
  });
const extraStep = (seq: number) => ({ ...fixture.steps[0], seq }) as Step;

test.each([
  ['with code', true],
  ['without code', false],
])('section order is SPEND, STEPS, CODE, OUTCOMES %s', async (_name, coding) => {
  detail = { ...running(), ...(coding ? {} : { coding: null }) };
  await setup();
  expect(testIds('run-detail', /^run-detail-(spend|steps|code|outcomes)$/)).toEqual([
    'run-detail-spend',
    'run-detail-steps',
    ...(coding ? ['run-detail-code'] : []),
    'run-detail-outcomes',
  ]);
  expect(
    within(screen.getByTestId('run-detail-steps')).getByRole('header', { name: 'STEPS' }),
  ).toBeTruthy();
});

test('a running run shows its steps live, newest first, keyed by seq', async () => {
  detail = running();
  await setup();
  expect(screen.getByTestId('run-detail-steps-live')).toBeTruthy();
  expect(stepIds()).toEqual([18, 17, 16, 15, 14, 13].map((seq) => `run-step-${seq}`));
  expect(screen.getByTestId('run-step-18')).toHaveProp(
    'accessibilityLabel',
    'Bash: npm test, in progress',
  );
  const markdown = screen.getByTestId('run-step-17-text');
  expect(markdown).toHaveTextContent('Bash: echo **bold** [link](https://example.test/x)');
  expect(markdown.props.onPress).toBeUndefined();
  expect(screen.queryByRole('link')).toBeNull();
  const before = screen.getByTestId('run-step-16');
  await mergeEvents();
  expect(stepIds()).toEqual([19, 18, 17, 16, 15, 14, 13].map((seq) => `run-step-${seq}`));
  expect(screen.getByTestId('run-step-18')).toHaveProp(
    'accessibilityLabel',
    'Bash: npm test, succeeded',
  );
  expect(screen.getByTestId('run-step-19')).toHaveProp(
    'accessibilityLabel',
    'Agent said: Tests pass; opening the pull request.',
  );
  expect(screen.getByTestId('run-step-16')).toBe(before);
  expect(getRun).toHaveBeenCalledTimes(1);
});

test('a step event for another run does not re-render the screen', async () => {
  detail = running();
  await setup();
  const count = renders;
  await act(async () => store.merge('run-other', [extraStep(99)]));
  expect(renders).toBe(count);
  await act(async () => store.merge('run-coding', [extraStep(99)]));
  expect(renders).toBeGreaterThan(count);
  expect(stepIds()[0]).toBe('run-step-99');
});

test('shows at most the newest 20 steps', async () => {
  detail = running();
  await setup();
  await act(async () =>
    store.merge(
      'run-coding',
      Array.from({ length: 30 }, (_, index) => extraStep(100 + index)),
    ),
  );
  const ids = stepIds();
  expect(ids).toHaveLength(20);
  expect(ids[0]).toBe('run-step-129');
  expect(ids[19]).toBe('run-step-110');
});

test('a running run with no steps yet is waiting', async () => {
  detail = { ...running(), steps: [], stepsOmitted: 0, stepsDropped: 0 };
  await setup();
  expect(screen.getByTestId('run-detail-steps-waiting')).toHaveTextContent(
    'Waiting for the first step…',
  );
});

test('steps off: a finished run says no steps were recorded, neutrally', async () => {
  detail = stepsOff as Detail;
  await setup();
  expect(screen.getByTestId('run-detail-steps-none')).toHaveTextContent(
    'No steps recorded for this run.',
  );
  expect(screen.getByTestId('run-detail-steps')).not.toHaveTextContent(/Retry|Couldn't/);
  expect(within(screen.getByTestId('run-detail-steps')).queryByRole('button')).toBeNull();
});

test.each([
  ['running', null],
  ['succeeded', '2026-10-01T10:06:00.000Z'],
] as const)('a pre-0.9 %s run shows steps as unavailable', async (status, finishedAt) => {
  detail = { ...(pre09 as unknown as Detail), status, finishedAt };
  await setup();
  expect(screen.getByTestId('run-detail-steps-unsupported')).toHaveTextContent(
    "Steps aren't available on this server",
  );
  expect(screen.getByTestId('run-detail-steps')).not.toHaveTextContent(/Retry|Couldn't/);
  expect(within(screen.getByTestId('run-detail-steps')).queryByRole('button')).toBeNull();
  expect(screen.getByTestId('run-detail-spend')).toHaveTextContent(/\$0\.12 of \$5\.00/);
  expect(screen.getByTestId('run-detail-code')).toHaveTextContent(/team\/project/);
  expect(screen.getByTestId('run-detail-outcomes')).toHaveTextContent(/No outcomes yet\./);
  await mergeEvents();
  expect(screen.queryByTestId('run-step-19')).toBeNull();
});

test('steps show loading while run detail reloads with no steps to show', async () => {
  detail = { ...running(), steps: [], stepsOmitted: 0, stepsDropped: 0 };
  const view = await setup();
  expect(screen.getByTestId('run-detail-steps-waiting')).toBeTruthy();
  getRun.mockImplementation(() => new Promise(() => {}));
  live = { ...live, resyncVersion: 1 };
  await view.rerender(<RunDetail />);
  expect(screen.getByTestId('run-detail-steps-loading')).toHaveTextContent('Loading steps…');
  expect(screen.queryByTestId('run-detail-steps-waiting')).toBeNull();
});

const notes = () => testIds('run-detail-steps', /^run-detail-steps-(omitted|dropped)$/);

test('a finished run shows its fetched steps newest first, with the omitted note', async () => {
  await setup();
  expect(screen.getByTestId('run-detail-steps-finished')).toBeTruthy();
  expect(stepIds()).toEqual([18, 17, 16, 15, 14, 13].map((seq) => `run-step-${seq}`));
  expect(screen.getByTestId('run-detail-steps-omitted')).toHaveTextContent(
    '12 earlier steps not shown',
  );
  expect(screen.queryByTestId('run-detail-steps-dropped')).toBeNull();
  expect(screen.queryByTestId('run-detail-steps-more')).toBeNull();
  expect(within(screen.getByTestId('run-detail-steps')).queryByRole('button')).toBeNull();
});

test('dropped steps: 20 rows, paging and both notes', async () => {
  detail = dropped as Detail;
  await setup();
  expect(stepIds()).toHaveLength(20);
  expect(stepIds()[0]).toBe('run-step-74');
  expect(screen.getByTestId('run-detail-steps-omitted')).toHaveTextContent(
    '40 earlier steps not shown',
  );
  expect(screen.getByTestId('run-detail-steps-dropped')).toHaveTextContent(
    "5 steps over the server's limit were not recorded",
  );
  await fireEvent.press(screen.getByTestId('run-detail-steps-more'));
  expect(stepIds()).toHaveLength(34);
  expect(screen.getByTestId('run-detail-steps-more')).toHaveTextContent(/Show fewer/);
  expect(notes()).toEqual(['run-detail-steps-omitted', 'run-detail-steps-dropped']);
});

test.each([
  [1, 0, ['1 earlier step not shown']],
  [0, 1, ["1 step over the server's limit was not recorded"]],
  [2, 3, ['2 earlier steps not shown', "3 steps over the server's limit were not recorded"]],
  [0, 0, []],
])('omitted %p and dropped %p notes use singular and plural', async (omitted, drop, texts) => {
  detail = { ...detail, stepsOmitted: omitted, stepsDropped: drop };
  await setup();
  expect(notes().map((id) => screen.getByTestId(id).props.children)).toEqual(texts);
});

test('pages 45 loaded steps 20 at a time, then shows fewer, without fetching', async () => {
  detail = many as Detail;
  await setup();
  const more = () => screen.getByTestId('run-detail-steps-more');
  expect(stepIds()).toHaveLength(20);
  expect(stepIds()[0]).toBe('run-step-48');
  expect(more()).toHaveTextContent(/Show 20 more/);
  expect(more()).toHaveProp('accessibilityLabel', 'Show 20 more steps, 20 of 45 shown');
  expect(more()).toHaveProp('accessibilityState', { disabled: false, expanded: false });
  await fireEvent.press(more());
  expect(stepIds()).toHaveLength(40);
  expect(more()).toHaveTextContent(/Show 20 more/);
  expect(more()).toHaveProp('accessibilityLabel', 'Show 20 more steps, 40 of 45 shown');
  await fireEvent.press(more());
  expect(stepIds()).toHaveLength(45);
  expect(stepIds()[44]).toBe('run-step-4');
  expect(more()).toHaveTextContent(/Show fewer/);
  expect(more()).toHaveProp('accessibilityLabel', 'Show fewer steps, 45 of 45 shown');
  expect(more()).toHaveProp('accessibilityState', { disabled: false, expanded: true });
  expect(screen.getByTestId('run-detail-steps-omitted')).toHaveTextContent(
    '3 earlier steps not shown',
  );
  await fireEvent.press(more());
  expect(stepIds()).toHaveLength(20);
  expect(more()).toHaveTextContent(/Show 20 more/);
  expect(getRun).toHaveBeenCalledTimes(1);
});

test('a finished run with no steps but omitted or dropped shows only the notes', async () => {
  detail = { ...detail, steps: [], stepsOmitted: 3, stepsDropped: 2 };
  await setup();
  expect(screen.getByTestId('run-detail-steps-finished')).toBeTruthy();
  // Only the two notes: no empty list box.
  expect(screen.getByTestId('run-detail-steps-finished').children).toHaveLength(2);
  expect(stepIds()).toEqual([]);
  expect(screen.queryByTestId('run-detail-steps-more')).toBeNull();
  expect(notes()).toEqual(['run-detail-steps-omitted', 'run-detail-steps-dropped']);
  expect(screen.getByTestId('run-detail-steps-omitted')).toHaveTextContent(
    '3 earlier steps not shown',
  );
});

test.each([
  ['steps off', stepsOff as Detail, 'run-detail-steps-none'],
  [
    'pre-0.9',
    { ...(pre09 as unknown as Detail), status: 'succeeded' } as Detail,
    'run-detail-steps-unsupported',
  ],
])('a finished %s run has no notes and no paging control', async (_name, value, testID) => {
  detail = value;
  await setup();
  expect(screen.getByTestId(testID)).toBeTruthy();
  expect(notes()).toEqual([]);
  expect(screen.queryByTestId('run-detail-steps-more')).toBeNull();
});

test('a run that finishes while open keeps merging live steps until the finished fetch', async () => {
  detail = { ...running(), outcomes: [] };
  live.graph!.runs = [detail];
  const view = await setup();
  let resolve: (value: Detail) => void = () => {};
  getRun.mockImplementation(() => new Promise<Detail>((done) => (resolve = done)));
  const finished = {
    ...detail,
    status: 'succeeded' as const,
    finishedAt: new Date(now).toISOString(),
    outcomes: [
      { kind: 'issue_comment' as const, provider: 'jira', issueKey: 'A-1', url: null, at: null },
    ],
  };
  live = { ...live, graph: { ...live.graph!, runs: [finished] } };
  await view.rerender(<RunDetail />);
  expect(getRun).toHaveBeenCalledTimes(2);
  // The late status for seq 18 and the last step arrive before the refetch resolves.
  await mergeEvents();
  expect(screen.getByTestId('run-step-18')).toHaveProp(
    'accessibilityLabel',
    'Bash: npm test, succeeded',
  );
  expect(stepIds()[0]).toBe('run-step-19');
  await act(async () => resolve({ ...finished, steps: fixture.steps } as Detail));
  expect(screen.getByTestId('run-detail-steps-finished')).toBeTruthy();
  expect(stepIds()).toEqual([19, 18, 17, 16, 15, 14, 13].map((seq) => `run-step-${seq}`));
  expect(screen.getByTestId('run-step-18')).toHaveProp(
    'accessibilityLabel',
    'Bash: npm test, succeeded',
  );
  // After the finished fetch, later step events for the run change nothing.
  await act(async () =>
    store.merge('run-coding', [extraStep(99), { ...fixture.steps[5], status: 'error' } as Step]),
  );
  expect(stepIds()).toEqual([19, 18, 17, 16, 15, 14, 13].map((seq) => `run-step-${seq}`));
  expect(screen.getByTestId('run-step-18')).toHaveProp(
    'accessibilityLabel',
    'Bash: npm test, succeeded',
  );
});

test('a run that finished while disconnected is refetched on reconnect: final steps appear', async () => {
  detail = { ...running(), outcomes: [] };
  live.graph!.runs = [detail];
  live = { ...live, loadVersion: 0 };
  const view = await setup();
  expect(getRun).toHaveBeenCalledTimes(1);
  expect(screen.getByTestId('run-detail-steps-live')).toBeTruthy();
  const finishedAt = new Date(now).toISOString();
  detail = {
    ...detail,
    status: 'succeeded',
    finishedAt,
    steps: [
      ...fixture.steps.slice(0, 5),
      { ...fixture.steps[5], status: 'ok' },
      { ...fixture.steps[0], seq: 19, tool: 'Bash', summary: 'gh pr create', status: 'ok' },
    ],
  } as Detail;
  // The reconnect's graph load shows the run finished, with the same outcomes.
  live = {
    ...live,
    graph: { ...live.graph!, runs: [{ ...live.graph!.runs[0], status: 'succeeded', finishedAt }] },
    loadVersion: 1,
  };
  await view.rerender(<RunDetail />);
  expect(getRun).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId('run-detail-status')).toHaveTextContent(/Succeeded/);
  expect(screen.getByTestId('run-detail-steps-finished')).toBeTruthy();
  expect(stepIds()[0]).toBe('run-step-19');
  expect(screen.getByTestId('run-step-19')).toHaveProp(
    'accessibilityLabel',
    'Bash: gh pr create, succeeded',
  );
  expect(screen.getByTestId('run-step-18')).toHaveProp(
    'accessibilityLabel',
    'Bash: npm test, succeeded',
  );
});
