import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as SplashScreen from 'expo-splash-screen';
import RootLayout from '../app/_layout';
import { useSession } from '../src/auth/session';
import { initializeAppearance } from '../src/settings/appearance';

jest.mock('expo-splash-screen', () => ({
  preventAutoHideAsync: jest.fn().mockResolvedValue(true),
  hideAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../src/auth/session', () => ({ useSession: jest.fn() }));
jest.mock('../src/settings/appearance', () => ({ initializeAppearance: jest.fn() }));
jest.mock('../src/live/useLiveGraph', () => ({
  LiveGraphProvider: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('expo-router', () => {
  const { View } = jest.requireActual('react-native');
  const Stack = () => <View testID="ready-navigation" />;
  Stack.Protected = function Protected() {
    return null;
  };
  Stack.Screen = function Screen() {
    return null;
  };
  return { Stack };
});

let ready: boolean;
let finishAppearance: () => void;
beforeEach(() => {
  jest.clearAllMocks();
  ready = false;
  (useSession as jest.Mock).mockImplementation(() => ({ ready, status: 'signedIn' }));
  (initializeAppearance as jest.Mock).mockReturnValue(
    new Promise<void>((resolve) => {
      finishAppearance = resolve;
    }),
  );
});

test('holds the native splash at module load', () => {
  // clearAllMocks resets the call history, so load the module again explicitly.
  jest.isolateModules(() => {
    jest.requireActual('../app/_layout');
    expect(SplashScreen.preventAutoHideAsync).toHaveBeenCalledTimes(1);
  });
});

test.each(['auth', 'theme'] as const)(
  'waits for %s, then hides only after the ready navigation lays out',
  async (last) => {
    const result = await render(<RootLayout />);
    expect(result.toJSON()).toBeNull();
    if (last === 'auth') {
      await act(async () => finishAppearance());
    } else {
      ready = true;
      await result.rerender(<RootLayout />);
    }
    expect(result.toJSON()).toBeNull();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
    if (last === 'auth') {
      ready = true;
      await result.rerender(<RootLayout />);
    } else {
      await act(async () => finishAppearance());
    }
    expect(screen.getByTestId('ready-navigation')).toBeTruthy();
    expect(SplashScreen.hideAsync).not.toHaveBeenCalled();
    await fireEvent(screen.getByTestId('app-ready'), 'layout');
    expect(SplashScreen.hideAsync).toHaveBeenCalledTimes(1);
  },
);
