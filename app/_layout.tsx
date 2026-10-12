import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useColorScheme } from 'react-native';
import { useSession } from '../src/auth/session';

export default function RootLayout() {
  const auth = useSession();
  const dark = useColorScheme() === 'dark';
  if (!auth.ready) return null;
  return (
    <ThemeProvider value={dark ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Protected guard={auth.status !== 'signedIn'}>
          <Stack.Screen name="connect" />
        </Stack.Protected>
        <Stack.Protected guard={auth.status === 'signedIn'}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="runs/[id]" options={{ headerShown: true, title: 'Run' }} />
        </Stack.Protected>
      </Stack>
    </ThemeProvider>
  );
}
