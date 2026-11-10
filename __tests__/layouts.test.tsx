import { render, screen } from '@testing-library/react-native';
import { DarkTheme, DefaultTheme, ExpoRoot, useTheme } from 'expo-router';
import { getMockContext } from 'expo-router/testing-library';
import * as ReactNative from 'react-native';
import { Text } from 'react-native';
import RootLayout from '../app/_layout';
import Connect from '../app/connect';
import TabsLayout from '../app/(tabs)/_layout';
import Runs from '../app/(tabs)/index';
import Spend from '../app/(tabs)/spend';
import Settings from '../app/(tabs)/settings';
import { theme } from '../components/ui/theme';
import { useSession } from '../src/auth/session';

jest.mock('../src/api/client', () => ({
  ...jest.requireActual('../src/api/client'),
  createApiClient: () => ({
    getGraph: async () => jest.requireActual('../src/api/__fixtures__/graph.json'),
  }),
}));
jest.mock('../src/auth/session', () => ({
  useSession: jest.fn(),
  session: { getAccessToken: jest.fn(), signOut: jest.fn() },
}));
jest.mock('../src/live/stream', () => ({ openEventStream: jest.fn() }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.0.0' } },
}));

function ThemeProbe() {
  const navigationTheme = useTheme();
  return (
    <>
      <Text testID="probe-dark">{String(navigationTheme.dark)}</Text>
      <Text testID="probe-primary">{String(navigationTheme.colors.primary)}</Text>
      <Text testID="probe-fonts">{JSON.stringify(navigationTheme.fonts)}</Text>
    </>
  );
}

const context = getMockContext({
  _layout: RootLayout,
  connect: Connect,
  probe: ThemeProbe,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': Runs,
  '(tabs)/spend': Spend,
  '(tabs)/settings': Settings,
});

beforeEach(() => {
  jest.clearAllMocks();
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
afterEach(() => jest.restoreAllMocks());

test.each(['light', 'dark'] as const)(
  'root layout gives navigation the %s theme with the app colours',
  async (mode) => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(mode);
    await render(<ExpoRoot context={context} location={new URL('http://localhost/probe')} />);
    const base = mode === 'dark' ? DarkTheme : DefaultTheme;
    expect(screen.getByTestId('probe-dark')).toHaveTextContent(String(base.dark));
    expect(screen.getByTestId('probe-primary')).toHaveTextContent(theme[mode].tint);
    expect(screen.getByTestId('probe-fonts')).toHaveTextContent(JSON.stringify(base.fonts));
  },
);

test.each(['light', 'dark'] as const)(
  'tab icons are drawn in the active and inactive tint colours in %s mode',
  async (mode) => {
    jest.spyOn(ReactNative, 'useColorScheme').mockReturnValue(mode);
    await render(<ExpoRoot context={context} location={new URL('http://localhost/')} />);
    for (const tab of ['runs', 'spend', 'settings']) {
      const colours = screen
        .getAllByTestId(`tab-${tab}-icon`)
        .map((icon) => ReactNative.StyleSheet.flatten(icon.props.style)?.color);
      expect(colours).toContainEqual(theme[mode].tint);
      expect(colours).toContainEqual(ReactNative.PlatformColor('secondaryLabel'));
    }
  },
);
