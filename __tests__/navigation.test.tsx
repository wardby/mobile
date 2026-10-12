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
import Settings from '../app/(tabs)/settings';
import { useSession } from '../src/auth/session';
import { openEventStream } from '../src/live/stream';

jest.mock('../src/auth/session', () => ({
  useSession: jest.fn(),
  session: { getAccessToken: jest.fn(), signOut: jest.fn() },
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
  expect(screen.queryByTestId('runs-placeholder')).toBeNull();
});
test('signedIn shows Runs', async () => {
  await render(app());
  expect(screen.getByTestId('runs-placeholder')).toHaveTextContent('RunsComing soon.');
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
  expect(screen.queryByTestId('spend-placeholder')).toBeNull();
});
test.each(['light', 'dark'] as const)(
  'tabs switch between labelled screens in %s mode',
  async (mode) => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(mode);
    await render(app());
    for (const name of ['Runs', 'Spend', 'Settings']) {
      expect(screen.getByTestId(`tab-${name.toLowerCase()}`)).toHaveProp(
        'accessibilityLabel',
        name,
      );
    }
    expect(screen.getByTestId('runs-placeholder')).toHaveTextContent('RunsComing soon.');
    await fireEvent.press(screen.getByTestId('tab-spend'));
    expect(screen.getByTestId('spend-placeholder')).toHaveTextContent('SpendComing soon.');
    await fireEvent.press(screen.getByTestId('tab-settings'));
    expect(screen.getByTestId('settings-host')).toHaveTextContent('server.example');
    expect(screen.getByTestId('settings-version')).toHaveTextContent('1.0.0');
    jest.restoreAllMocks();
  },
);
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
