import '../global.css';
import { GluestackUIProvider, useTheme } from '../components/ui/provider';
import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useColorScheme } from 'react-native';
import { LiveGraphProvider } from '../src/live/useLiveGraph';
import { useSession } from '../src/auth/session';

export default function RootLayout() {
  const auth = useSession();
  const colors = useTheme();
  const dark = useColorScheme() === 'dark';
  if (!auth.ready) return null;
  return (
    <GluestackUIProvider>
      <ThemeProvider
        value={{
          ...(dark ? DarkTheme : DefaultTheme),
          colors: {
            ...(dark ? DarkTheme : DefaultTheme).colors,
            primary: colors.tint,
            background: colors.background,
            card: colors.background,
            text: colors.text,
            border: colors.border,
            notification: colors.destructive,
          },
        }}
      >
        <LiveGraphProvider>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected guard={auth.status !== 'signedIn'}>
              <Stack.Screen name="connect" />
            </Stack.Protected>
            <Stack.Protected guard={auth.status === 'signedIn'}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="runs/[id]" options={{ headerShown: true, title: 'Run' }} />
            </Stack.Protected>
          </Stack>
        </LiveGraphProvider>
      </ThemeProvider>
    </GluestackUIProvider>
  );
}
