import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { ExpoRoot, router } from 'expo-router';
import { getMockContext } from 'expo-router/testing-library';
import * as ReactNative from 'react-native';
import { Alert } from 'react-native';
import RootLayout from '../app/_layout';
import Connect from '../app/connect';
import TabsLayout from '../app/(tabs)/_layout';
import Runs from '../app/(tabs)/index';
import Spend from '../app/(tabs)/spend';
import Infra from '../app/(tabs)/infra';
import Settings from '../app/(tabs)/settings';
import { useSession } from '../src/auth/session';
import { openEventStream } from '../src/live/stream';

jest.mock('../src/api/client', () => ({
  ...jest.requireActual('../src/api/client'),
  createApiClient: () => ({
    getGraph: async () => jest.requireActual('../src/api/__fixtures__/graph.json'),
  }),
}));
jest.mock('@expo/vector-icons/Ionicons', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    __esModule: true,
    default: ({ name, ...props }: { name: string }) => <Text {...props}>{name}</Text>,
  };
});
jest.mock('../src/auth/session', () => ({
  useSession: jest.fn(),
  session: {
    apiClient: () => ({
      getInfra: async () => jest.requireActual('../src/api/__fixtures__/infra.json'),
    }),
    getAccessToken: jest.fn(),
    signOut: jest.fn(),
  },
}));
jest.mock('../src/live/stream', () => ({ openEventStream: jest.fn() }));
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
});
let auth: ReturnType<typeof useSession>;
const app = () => <ExpoRoot context={context} location={new URL('http://localhost/')} />;
beforeEach(() => {
  jest.clearAllMocks();
  auth = {
    ready: true,
    status: 'signedIn',
    host: 'https://server.example',
    error: null,
    signIn: jest.fn(),
    signOut: jest.fn(),
    clearError: jest.fn(),
  };
  (useSession as jest.Mock).mockImplementation(() => auth);
});
test('signedOut shows Connect', async () => {
  auth.status = 'signedOut';
  await render(app());
  expect(screen.getByTestId('connect-host')).toBeTruthy();
  expect(screen.queryByTestId('runs-loading')).toBeNull();
});
test('signedIn shows Runs', async () => {
  await render(app());
  expect(screen.getByTestId('runs-loading')).toHaveTextContent('Loading runs…');
});
test('unknown session renders nothing', async () => {
  auth.ready = false;
  const result = await render(<RootLayout />);
  expect(result.toJSON()).toBeNull();
});
test('signingIn stays on Connect with its spinner', async () => {
  auth.status = 'signingIn';
  await render(app());
  expect(screen.getByTestId('connect-submit')).toBeDisabled();
  expect(screen.getByText('Signing in…')).toBeTruthy();
});
test('session invalidation from Spend opens Connect and clears signed-in history', async () => {
  const result = await render(app());
  await fireEvent.press(screen.getByTestId('tab-spend'));
  auth = { ...auth, status: 'signedOut', host: null };
  await result.rerender(app());
  expect(screen.getByTestId('connect-host')).toBeTruthy();
  expect(router.canGoBack()).toBe(false);
  expect(screen.queryByTestId('spend-period-week')).toBeNull();
});
test.each(['light', 'dark'] as const)(
  'tabs switch between labelled screens in %s mode',
  async (mode) => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(mode);
    await render(app());
    const labels: Record<string, string> = { Infra: 'Infrastructure' };
    for (const name of ['Runs', 'Spend', 'Infra', 'Settings']) {
      expect(screen.getByTestId(`tab-${name.toLowerCase()}`)).toHaveProp(
        'accessibilityLabel',
        labels[name] ?? name,
      );
    }
    expect(screen.getByTestId('tab-infra-label')).toHaveTextContent('Infra', { exact: true });
    expect(screen.getByTestId('runs-loading')).toHaveTextContent('Loading runs…');
    await fireEvent.press(screen.getByTestId('tab-spend'));
    expect(screen.getByTestId('spend-period-week')).toHaveTextContent('This week');
    await fireEvent.press(screen.getByTestId('tab-infra'));
    expect(await screen.findByTestId('infra-coding-launcher')).toHaveTextContent('Docker');
    expect(screen.getAllByText('Infrastructure').length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByTestId('tab-settings'));
    expect(screen.getByTestId('settings-host')).toHaveTextContent('server.example');
    expect(screen.getByTestId('settings-version')).toHaveTextContent('1.0.0');
    jest.restoreAllMocks();
  },
);
test('each tab button is one accessible element found by its testID and opens its screen', async () => {
  await render(app());
  expect(screen.getByTestId('screen-runs')).toBeTruthy();
  const labels = { runs: 'Runs', spend: 'Spend', infra: 'Infrastructure', settings: 'Settings' };
  for (const [tab, label] of Object.entries(labels)) {
    const button = screen.getByTestId(`tab-${tab}`);
    expect(button).toHaveProp('accessible', true);
    expect(button).toHaveProp('role', 'button');
    expect(button).toHaveProp('accessibilityLabel', label);
    // The label and icon sit inside the button, not as separate accessibility elements.
    expect(screen.getByTestId(`tab-${tab}-label`)).toHaveProp('accessible', false);
    expect(screen.getAllByTestId(`tab-${tab}-icon`)[0]).toHaveProp('accessible', false);
  }
  for (const tab of ['spend', 'infra', 'settings', 'runs']) {
    await fireEvent.press(screen.getByTestId(`tab-${tab}`));
    expect(screen.getByTestId(`screen-${tab}`)).toBeTruthy();
  }
});
test('Settings confirmation supports Cancel and signs out to Connect on confirm', async () => {
  const alert = jest.spyOn(Alert, 'alert');
  const result = await render(app());
  await fireEvent.press(screen.getByTestId('tab-settings'));
  await fireEvent.press(screen.getByTestId('settings-sign-out'));
  expect(alert).toHaveBeenCalledWith('Sign out of server.example?', undefined, expect.any(Array));
  const buttons = alert.mock.calls[0][2]!;
  expect(buttons.map((button) => button.text)).toEqual(['Cancel', 'Sign out']);
  await act(async () => {
    buttons[0].onPress?.();
  });
  expect(auth.signOut).not.toHaveBeenCalled();
  expect(screen.getByTestId('settings-host')).toBeTruthy();
  expect(buttons[1].style).toBe('destructive');
  await act(async () => {
    buttons[1].onPress?.();
  });
  expect(auth.signOut).toHaveBeenCalledTimes(1);
  auth = { ...auth, status: 'signedOut', host: null };
  await result.rerender(app());
  expect(screen.getByTestId('connect-host')).toBeTruthy();
  expect(router.canGoBack()).toBe(false);
  alert.mockRestore();
});
test('signed-in tabs share one live event stream that closes on sign-out', async () => {
  const result = await render(app());
  await fireEvent.press(screen.getByTestId('tab-spend'));
  expect(openEventStream).toHaveBeenCalledTimes(1);
  const { baseUrl, signal } = (openEventStream as jest.Mock).mock.calls[0][0];
  expect(baseUrl).toBe('https://server.example');
  expect(signal.aborted).toBe(false);
  auth = { ...auth, status: 'signedOut', host: null };
  await result.rerender(app());
  expect(signal.aborted).toBe(true);
  expect(openEventStream).toHaveBeenCalledTimes(1);
});

test.each(['light', 'dark'] as const)(
  'tab bar has readable scaling labels, icons and large targets in %s mode',
  async (mode) => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(mode);
    jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
      width: 390,
      height: 844,
      scale: 3,
      fontScale: 2,
    });
    await render(app());
    for (const name of ['runs', 'spend', 'infra', 'settings']) {
      let item = screen.getByTestId(`tab-${name}`).parent;
      while (item && ReactNative.StyleSheet.flatten(item.props.style)?.minHeight !== 44) {
        item = item.parent;
      }
      expect(ReactNative.StyleSheet.flatten(item?.props.style)).toEqual(
        expect.objectContaining({ minWidth: 44, minHeight: 44 }),
      );
      expect(screen.getByTestId(`tab-${name}-label`)).toHaveProp('allowFontScaling', true);
      expect(screen.getByTestId(`tab-${name}-label`)).toHaveStyle({ fontSize: 14 });
      expect(screen.getAllByTestId(`tab-${name}-icon`).length).toBeGreaterThan(0);
    }
    expect(screen.getByTestId('tab-runs-label')).toHaveStyle({ fontWeight: '700' });
    expect(screen.getByTestId('tab-spend-label')).toHaveStyle({ fontWeight: '400' });
    expect(screen.getAllByTestId('tab-runs-icon')[0]).toHaveTextContent('list-circle');
    await fireEvent.press(screen.getByTestId('tab-spend'));
    expect(screen.getByTestId('tab-runs-label')).toHaveStyle({ fontWeight: '400' });
    expect(screen.getByTestId('tab-spend-label')).toHaveStyle({ fontWeight: '700' });
    expect(screen.getAllByTestId('tab-spend-icon')[0]).toHaveTextContent('pie-chart');
    // Both icon variants render; the visible one sits in the wrapper with opacity 1.
    const infraIcon = () =>
      screen
        .getAllByTestId('tab-infra-icon')
        .find((icon) => ReactNative.StyleSheet.flatten(icon.parent?.props.style)?.opacity === 1);
    expect(infraIcon()).toHaveTextContent('server-outline', { exact: true });
    expect(screen.getByTestId('tab-infra-label')).toHaveStyle({ fontWeight: '400' });
    await fireEvent.press(screen.getByTestId('tab-infra'));
    expect(infraIcon()).toHaveTextContent('server', { exact: true });
    expect(screen.getByTestId('tab-infra-label')).toHaveStyle({ fontWeight: '700' });
    jest.restoreAllMocks();
  },
);

test('four tabs fit a 320 pt wide phone at fontScale 2', async () => {
  jest.spyOn(ReactNative, 'useWindowDimensions').mockReturnValue({
    width: 320,
    height: 568,
    scale: 2,
    fontScale: 2,
  });
  await render(app());
  const tabs = ['runs', 'spend', 'infra', 'settings'];
  const order = screen
    .getAllByTestId(/^tab-(runs|spend|infra|settings)$/)
    .map((tab) => tab.props.testID);
  expect(order).toEqual(['tab-runs', 'tab-spend', 'tab-infra', 'tab-settings']);
  expect(screen.getByTestId('tab-infra-label')).toHaveTextContent('Infra', { exact: true });
  for (const name of tabs) {
    const label = screen.getByTestId(`tab-${name}-label`);
    expect(label).toHaveProp('allowFontScaling', true);
    expect(label).toHaveStyle({ fontSize: 14 });
    expect(label.props.numberOfLines).toBeUndefined();
    let item = screen.getByTestId(`tab-${name}`).parent;
    while (item && ReactNative.StyleSheet.flatten(item.props.style)?.minHeight !== 44) {
      item = item.parent;
    }
    expect(ReactNative.StyleSheet.flatten(item?.props.style)).toEqual(
      expect.objectContaining({ minWidth: 44, minHeight: 44 }),
    );
  }
  jest.restoreAllMocks();
});
