import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import * as ReactNative from 'react-native';
import Infrastructure from '../../app/(tabs)/infra';
import dockerFixture from '../../src/api/__fixtures__/infra.json';
import kubernetesFixture from '../../src/api/__fixtures__/infra-kubernetes.json';
import unconfiguredFixture from '../../src/api/__fixtures__/infra-unconfigured.json';
import invalidToken from '../../src/api/__fixtures__/invalid_token.json';
import internalError from '../../src/api/__fixtures__/internal_error.json';
import { createApiClient } from '../../src/api/client';
import type { components } from '../../src/api/schema';
import { session } from '../../src/auth/session';
import { theme } from '../../components/ui/theme';

let mockFocus: () => void;
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = jest.requireActual('react');
    React.useEffect(() => {
      mockFocus = callback;
      return callback();
    }, [callback]);
  },
}));
jest.mock('../../src/auth/session', () => ({ session: { apiClient: jest.fn() } }));

type Infra = components['schemas']['infra-info'];
const docker = dockerFixture as Infra;
const kubernetes = kubernetesFixture as Infra;
const unconfigured = unconfiguredFixture as Infra;
const coding = kubernetes.kubernetes!;
const codingEntries = [
  ...Object.entries(coding.componentLabel),
  ...Object.entries(coding.managedByLabel),
].map(([key, value]) => `${key}=${value}`);
const native = kubernetes.native!.kubernetes!;
const nativeEntries = [
  ...Object.entries(native.componentLabel),
  ...Object.entries(native.warmPoolLabel),
].map(([key, value]) => `${key}=${value}`);

type Reply = { status: number; body: unknown };
let replies: Reply[];
let fetchMock: jest.Mock;
let onUnauthorized: jest.Mock;
// A real client: each request gets the next recorded fixture (the last one repeats).
const reply = (...next: Reply[]) => {
  replies = next;
};
const ok = (body: Infra): Reply => ({ status: 200, body });
const pending = () => {
  let resolve!: (response: Response) => void;
  fetchMock.mockImplementationOnce(
    () =>
      new Promise<Response>((r) => {
        resolve = r;
      }),
  );
  return (body: unknown, status = 200) => resolve(new Response(JSON.stringify(body), { status }));
};
const refresh = () =>
  act(async () => {
    await screen.getByTestId('infra-scroll').props.refreshControl.props.onRefresh();
  });

beforeEach(() => {
  jest.clearAllMocks();
  replies = [ok(docker)];
  onUnauthorized = jest.fn();
  fetchMock = jest.fn(async () => {
    const next = replies.length > 1 ? replies.shift()! : replies[0];
    return new Response(JSON.stringify(next.body), { status: next.status });
  });
  (session.apiClient as jest.Mock).mockImplementation(() =>
    createApiClient({
      baseUrl: 'https://example.invalid',
      getAccessToken: () => null,
      onUnauthorized,
      fetch: fetchMock,
    }),
  );
});
afterEach(() => jest.restoreAllMocks());

test('loading shows a spinner, then the Docker launcher without Kubernetes', async () => {
  const resolve = pending();
  await render(<Infrastructure />);
  expect(screen.getByTestId('infra-loading')).toHaveTextContent('Loading infrastructure…');
  expect(screen.queryByTestId('infra-coding')).toBeNull();
  await act(async () => resolve(docker));
  expect(screen.queryByTestId('infra-loading')).toBeNull();
  expect(fetchMock).toHaveBeenCalledWith(
    'https://example.invalid/admin/api/infra',
    expect.objectContaining({ method: 'GET' }),
  );
  expect(screen.getByTestId('infra-coding')).toBeTruthy();
  expect(screen.getByText('CODING LAUNCHER')).toHaveProp('accessibilityRole', 'header');
  expect(screen.getByTestId('infra-coding-launcher')).toHaveTextContent('Docker');
  expect(screen.queryByTestId('infra-coding-kubernetes')).toBeNull();
  expect(screen.queryByTestId('infra-coding-kubernetes-missing')).toBeNull();
  expect(screen.queryByTestId('infra-coding-not-configured')).toBeNull();
  expect(screen.queryByTestId('infra-coding-labels-toggle')).toBeNull();
});

test('Kubernetes shows every coding Kubernetes row in order', async () => {
  reply(ok(kubernetes));
  await render(<Infrastructure />);
  expect(await screen.findByTestId('infra-coding-launcher')).toHaveTextContent('Kubernetes');
  const block = screen.getByTestId('infra-coding-kubernetes');
  const rows: [string, string][] = [
    ['Namespace', coding.namespace],
    ['Platform', coding.platform],
    ['Runtime class', coding.runtimeClass!],
    ['Proxy service', coding.proxyService],
    ['Run label', coding.runLabel],
    ['Run label hash', `${coding.runLabelHashChars} characters`],
  ];
  for (const [label, value] of rows) {
    expect(within(block).getByText(label)).toBeTruthy();
    expect(within(block).getByText(value)).toBeTruthy();
  }
  const text = within(block)
    .getAllByText(/./)
    .map((node) => node.props.children)
    .filter((child) => typeof child === 'string');
  expect(text.indexOf('Namespace')).toBeLessThan(text.indexOf('Platform'));
  expect(text.indexOf('Platform')).toBeLessThan(text.indexOf('Runtime class'));
  expect(text.indexOf('Runtime class')).toBeLessThan(text.indexOf('Proxy service'));
  expect(text.indexOf('Proxy service')).toBeLessThan(text.indexOf('Run label'));
  expect(text.indexOf('Run label')).toBeLessThan(text.indexOf('Run label hash'));
  expect(screen.queryByTestId('infra-coding-not-configured')).toBeNull();
});

test('a Kubernetes launcher without details says they were not reported', async () => {
  reply(ok({ ...kubernetes, kubernetes: null }));
  await render(<Infrastructure />);
  expect(await screen.findByTestId('infra-coding-kubernetes-missing')).toHaveTextContent(
    'Kubernetes details not reported',
  );
  expect(screen.getByTestId('infra-coding-launcher')).toHaveTextContent('Kubernetes');
  expect(screen.queryByTestId('infra-coding-kubernetes')).toBeNull();
  expect(screen.queryByTestId('infra-coding-labels-toggle')).toBeNull();
});

test('not configured: "Not configured" and the muted explanation, never "Local"', async () => {
  reply(ok(unconfigured));
  await render(<Infrastructure />);
  expect(await screen.findByTestId('infra-coding-launcher')).toHaveTextContent('Not configured');
  expect(screen.getByTestId('infra-coding-not-configured')).toHaveTextContent(
    "Coding agents can't run on this server. It needs a Docker or Kubernetes launcher.",
  );
  expect(screen.queryByTestId('infra-coding-kubernetes')).toBeNull();
  expect(screen.queryByTestId('infra-coding-kubernetes-missing')).toBeNull();
  expect(screen.queryByText(/local/i)).toBeNull();
  expect(screen.queryByText(/server host/i)).toBeNull();
});

test('coding labels are collapsed by default', async () => {
  reply(ok(kubernetes));
  await render(<Infrastructure />);
  const toggle = await screen.findByTestId('infra-coding-labels-toggle');
  expect(toggle).toHaveTextContent(`Show labels (${codingEntries.length})`, { exact: false });
  expect(toggle).toHaveProp('accessibilityLabel', `Show labels (${codingEntries.length})`);
  expect(toggle).toHaveProp('accessibilityState', expect.objectContaining({ expanded: false }));
  for (const entry of codingEntries) expect(screen.queryByText(entry)).toBeNull();
  expect(screen.queryByText('Component labels')).toBeNull();
  expect(screen.queryByText('Managed-by labels')).toBeNull();
});

test('the coding labels toggle shows every entry, then hides them again', async () => {
  reply(ok(kubernetes));
  await render(<Infrastructure />);
  await fireEvent.press(await screen.findByTestId('infra-coding-labels-toggle'));
  let toggle = screen.getByTestId('infra-coding-labels-toggle');
  expect(toggle).toHaveTextContent('Hide labels', { exact: false });
  expect(toggle).toHaveProp('accessibilityLabel', 'Hide labels');
  expect(toggle).toHaveProp('accessibilityState', expect.objectContaining({ expanded: true }));
  const block = screen.getByTestId('infra-coding-kubernetes');
  expect(within(block).getByText('Component labels')).toBeTruthy();
  expect(within(block).getByText('Managed-by labels')).toBeTruthy();
  for (const entry of codingEntries) expect(within(block).getByText(entry)).toBeTruthy();
  await fireEvent.press(toggle);
  toggle = screen.getByTestId('infra-coding-labels-toggle');
  expect(toggle).toHaveTextContent(`Show labels (${codingEntries.length})`, { exact: false });
  expect(toggle).toHaveProp('accessibilityState', expect.objectContaining({ expanded: false }));
  for (const entry of codingEntries) expect(screen.queryByText(entry)).toBeNull();
});

test('an empty label map reads "None" when expanded', async () => {
  reply(ok({ ...kubernetes, kubernetes: { ...coding, managedByLabel: {} } }));
  await render(<Infrastructure />);
  const toggle = await screen.findByTestId('infra-coding-labels-toggle');
  expect(toggle).toHaveTextContent('Show labels (1)', { exact: false });
  await fireEvent.press(toggle);
  expect(screen.getByText('None')).toBeTruthy();
});

test('a refetch with a new response collapses the coding labels again', async () => {
  reply(ok(kubernetes));
  await render(<Infrastructure />);
  await fireEvent.press(await screen.findByTestId('infra-coding-labels-toggle'));
  expect(screen.getByText(codingEntries[0])).toBeTruthy();
  await refresh();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(screen.getByTestId('infra-coding-labels-toggle')).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ expanded: false }),
  );
  for (const entry of codingEntries) expect(screen.queryByText(entry)).toBeNull();
  await fireEvent.press(screen.getByTestId('infra-coding-labels-toggle'));
  await act(async () => mockFocus());
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
  expect(screen.queryByText(codingEntries[0])).toBeNull();
});

test('Docker native agents show the launcher and warm pool, without Kubernetes', async () => {
  await render(<Infrastructure />);
  const section = await screen.findByTestId('infra-native');
  expect(within(section).getByText('NATIVE AGENTS')).toHaveProp('accessibilityRole', 'header');
  expect(screen.getByTestId('infra-native-launcher')).toHaveTextContent('Docker');
  expect(screen.getByTestId('infra-native-warm-pool')).toHaveTextContent('2 workers');
  expect(within(section).getByText('Warm pool')).toBeTruthy();
  expect(screen.queryByTestId('infra-native-kubernetes')).toBeNull();
  expect(screen.queryByTestId('infra-native-labels-toggle')).toBeNull();
  expect(screen.queryByTestId('infra-native-not-configured')).toBeNull();
});

test('the native section sits below the coding launcher section', async () => {
  await render(<Infrastructure />);
  await screen.findByTestId('infra-native');
  const headers = screen.getAllByRole('header').map((node) => node.props.children);
  expect(headers).toEqual(['CODING LAUNCHER', 'NATIVE AGENTS']);
});

test('Kubernetes native agents show every native Kubernetes row in order', async () => {
  reply(ok(kubernetes));
  await render(<Infrastructure />);
  expect(await screen.findByTestId('infra-native-launcher')).toHaveTextContent('Kubernetes');
  expect(screen.getByTestId('infra-native-warm-pool')).toHaveTextContent('3 workers');
  const block = screen.getByTestId('infra-native-kubernetes');
  const rows: [string, string][] = [
    ['Namespace', native.namespace],
    ['Runtime class', 'Default'],
    ['Run label', native.runLabel],
    ['Warm worker', native.warmWorkerLabel],
  ];
  for (const [label, value] of rows) {
    expect(within(block).getByText(label)).toBeTruthy();
    expect(within(block).getByText(value)).toBeTruthy();
  }
  const text = within(block)
    .getAllByText(/./)
    .map((node) => node.props.children)
    .filter((child) => typeof child === 'string');
  expect(text.indexOf('Namespace')).toBeLessThan(text.indexOf('Runtime class'));
  expect(text.indexOf('Runtime class')).toBeLessThan(text.indexOf('Run label'));
  expect(text.indexOf('Run label')).toBeLessThan(text.indexOf('Warm worker'));
  expect(screen.queryByTestId('infra-native-not-configured')).toBeNull();
});

test('native labels are collapsed by default', async () => {
  reply(ok(kubernetes));
  await render(<Infrastructure />);
  const toggle = await screen.findByTestId('infra-native-labels-toggle');
  expect(toggle).toHaveTextContent(`Show labels (${nativeEntries.length})`, { exact: false });
  expect(toggle).toHaveProp('accessibilityLabel', `Show labels (${nativeEntries.length})`);
  expect(toggle).toHaveProp('accessibilityState', expect.objectContaining({ expanded: false }));
  for (const entry of nativeEntries) expect(screen.queryByText(entry)).toBeNull();
  expect(screen.queryByText('Component labels')).toBeNull();
  expect(screen.queryByText('Warm pool labels')).toBeNull();
});

test('the native labels toggle shows every entry, then hides them, independently of coding', async () => {
  reply(ok(kubernetes));
  await render(<Infrastructure />);
  await fireEvent.press(await screen.findByTestId('infra-native-labels-toggle'));
  let toggle = screen.getByTestId('infra-native-labels-toggle');
  expect(toggle).toHaveTextContent('Hide labels', { exact: false });
  expect(toggle).toHaveProp('accessibilityLabel', 'Hide labels');
  expect(toggle).toHaveProp('accessibilityState', expect.objectContaining({ expanded: true }));
  const block = screen.getByTestId('infra-native-kubernetes');
  expect(within(block).getByText('Component labels')).toBeTruthy();
  expect(within(block).getByText('Warm pool labels')).toBeTruthy();
  for (const entry of nativeEntries) expect(within(block).getByText(entry)).toBeTruthy();
  const coding = screen.getByTestId('infra-coding-labels-toggle');
  expect(coding).toHaveTextContent(`Show labels (${codingEntries.length})`, { exact: false });
  expect(coding).toHaveProp('accessibilityState', expect.objectContaining({ expanded: false }));
  for (const entry of codingEntries) expect(screen.queryByText(entry)).toBeNull();
  await fireEvent.press(toggle);
  toggle = screen.getByTestId('infra-native-labels-toggle');
  expect(toggle).toHaveTextContent(`Show labels (${nativeEntries.length})`, { exact: false });
  expect(toggle).toHaveProp('accessibilityState', expect.objectContaining({ expanded: false }));
  for (const entry of nativeEntries) expect(screen.queryByText(entry)).toBeNull();
});

test('expanding the coding labels leaves the native labels collapsed', async () => {
  reply(ok(kubernetes));
  await render(<Infrastructure />);
  await fireEvent.press(await screen.findByTestId('infra-coding-labels-toggle'));
  expect(screen.getByTestId('infra-native-labels-toggle')).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ expanded: false }),
  );
  for (const entry of nativeEntries) expect(screen.queryByText(entry)).toBeNull();
});

test('a refetch with a new response collapses both label blocks again', async () => {
  reply(ok(kubernetes));
  await render(<Infrastructure />);
  await fireEvent.press(await screen.findByTestId('infra-coding-labels-toggle'));
  await fireEvent.press(screen.getByTestId('infra-native-labels-toggle'));
  expect(screen.getByText(codingEntries[0])).toBeTruthy();
  expect(screen.getByText(nativeEntries[0])).toBeTruthy();
  await refresh();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  for (const id of ['infra-coding-labels-toggle', 'infra-native-labels-toggle'])
    expect(screen.getByTestId(id)).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ expanded: false }),
    );
  for (const entry of [...codingEntries, ...nativeEntries])
    expect(screen.queryByText(entry)).toBeNull();
});

test('native agents not configured: muted text and no launcher or warm-pool rows', async () => {
  reply(ok(unconfigured));
  await render(<Infrastructure />);
  const section = await screen.findByTestId('infra-native');
  expect(within(section).getByText('NATIVE AGENTS')).toBeTruthy();
  expect(screen.getByTestId('infra-native-not-configured')).toHaveTextContent(
    "Native agents aren't configured on this server.",
  );
  expect(screen.queryByTestId('infra-native-launcher')).toBeNull();
  expect(screen.queryByTestId('infra-native-warm-pool')).toBeNull();
  expect(screen.queryByTestId('infra-native-kubernetes')).toBeNull();
});

test('pull-to-refresh refetches, and refreshing follows loading', async () => {
  await render(<Infrastructure />);
  await screen.findByTestId('infra-coding');
  const control = () => screen.getByTestId('infra-scroll').props.refreshControl;
  expect(control().props.testID).toBe('infra-refresh');
  expect(control().props.accessibilityLabel).toBe('Refresh infrastructure');
  expect(control().props.refreshing).toBe(false);
  const resolve = pending();
  let done!: Promise<void>;
  await act(async () => {
    done = control().props.onRefresh();
  });
  expect(control().props.refreshing).toBe(true);
  expect(screen.getByTestId('infra-coding-launcher')).toHaveTextContent('Docker');
  await act(async () => {
    resolve(kubernetes);
    await done;
  });
  expect(control().props.refreshing).toBe(false);
  expect(screen.getByTestId('infra-coding-launcher')).toHaveTextContent('Kubernetes');
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test.each([
  ['500', 500, internalError],
  ['403', 403, invalidToken],
])('a %s shows the error state, and Retry loads again', async (_, status, body) => {
  reply({ status, body }, ok(docker));
  await render(<Infrastructure />);
  const error = await screen.findByTestId('infra-error');
  expect(error).toHaveTextContent("Couldn't load infrastructure.", { exact: false });
  expect(screen.queryByTestId('infra-coding')).toBeNull();
  expect(onUnauthorized).not.toHaveBeenCalled();
  const retry = screen.getByTestId('infra-retry');
  expect(retry).toHaveProp('accessibilityLabel', 'Retry');
  await fireEvent.press(retry);
  await waitFor(() => expect(screen.getByTestId('infra-coding-launcher')).toBeTruthy());
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(screen.queryByTestId('infra-error')).toBeNull();
});

test('a 401 leaves sign-out to the client', async () => {
  reply({ status: 401, body: invalidToken });
  await render(<Infrastructure />);
  await screen.findByTestId('infra-error');
  expect(onUnauthorized).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('a network failure shows the error state', async () => {
  fetchMock.mockRejectedValueOnce(new TypeError('offline'));
  await render(<Infrastructure />);
  expect(await screen.findByTestId('infra-error')).toBeTruthy();
});

test.each(['light', 'dark'] as const)('renders with theme colours in %s mode', async (mode) => {
  jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(mode);
  reply(ok(kubernetes));
  await render(<Infrastructure />);
  const toggle = await screen.findByTestId('infra-coding-labels-toggle');
  expect(within(toggle).getByText(/Show labels/)).toHaveStyle({ color: theme[mode].tint });
  expect(screen.getByText('CODING LAUNCHER')).toHaveStyle({
    color: ReactNative.PlatformColor('secondaryLabel'),
  });
  expect(screen.getByTestId('infra-coding-launcher')).toHaveStyle({
    color: ReactNative.PlatformColor('label'),
  });
});
