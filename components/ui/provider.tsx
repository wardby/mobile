import { OverlayProvider } from '@gluestack-ui/core/overlay/creator';
import { createContext, useContext, type ReactNode } from 'react';
import { Platform, PlatformColor, useColorScheme, View } from 'react-native';
import { vars } from 'nativewind';
import { theme, themeVariables, type Mode } from './theme';

const ThemeContext = createContext<Mode | null>(null);
export function useThemeMode(): Mode {
  const provided = useContext(ThemeContext);
  const system = useColorScheme();
  return provided ?? (system === 'dark' ? 'dark' : 'light');
}
export function useTheme() {
  const colors = theme[useThemeMode()];
  if (Platform.OS === 'ios') {
    return {
      ...colors,
      background: PlatformColor('systemBackground'),
      text: PlatformColor('label'),
      muted: PlatformColor('secondaryLabel'),
      border: PlatformColor('secondaryLabel'),
      destructive: PlatformColor('systemRed'),
    };
  }
  if (Platform.OS === 'android') {
    return {
      ...colors,
      background: PlatformColor('?android:attr/colorBackground'),
      text: PlatformColor('?android:attr/textColorPrimary'),
      muted: PlatformColor('?android:attr/textColorSecondary'),
      border: PlatformColor('?android:attr/textColorSecondary'),
      destructive: PlatformColor('?android:attr/colorError'),
    };
  }
  return colors;
}

export function GluestackUIProvider({ children }: { children: ReactNode }) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  return (
    <ThemeContext.Provider value={mode}>
      <OverlayProvider>
        <View style={[{ flex: 1 }, vars(themeVariables(mode))]}>{children}</View>
      </OverlayProvider>
    </ThemeContext.Provider>
  );
}
