import '../global.css';
import { useEffect, useState } from 'react';
import { initializeAppearance } from '../src/settings/appearance';
import { GluestackUIProvider, useTheme } from '../components/ui/provider';
import { Stack } from 'expo-router';
import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router/react-navigation';
import { useColorScheme, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { LiveGraphProvider } from '../src/live/useLiveGraph';
import { useSession } from '../src/auth/session';

// Hold the native launch screen before React mounts, including during session restoration.
void SplashScreen.preventAutoHideAsync().catch(() => {
  // A splash screen may not be available (for example on web).
});

export default function RootLayout() {
  const auth = useSession();
  const [appearanceReady, setAppearanceReady] = useState(false);
  useEffect(() => {
    void initializeAppearance().then(() => setAppearanceReady(true));
  }, []);
  const colors = useTheme();
  const dark = useColorScheme() === 'dark';
  if (!auth.ready || !appearanceReady) return null;
  return (
    <GluestackUIProvider>
      <View
        testID="app-ready"
        className="flex-1"
        style={{ backgroundColor: colors.background }}
        onLayout={() => {
          void SplashScreen.hideAsync().catch(() => {
            // The native splash may already have been dismissed.
          });
        }}
      >
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
      </View>
    </GluestackUIProvider>
  );
}
