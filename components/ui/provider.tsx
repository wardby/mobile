import { createContext, useContext, type ReactNode } from 'react';
import { useColorScheme, View } from 'react-native';
import { vars } from 'nativewind';
import { theme, themeVariables, type Mode } from './theme';

const ThemeContext = createContext<Mode | null>(null);
export function useThemeMode(): Mode {
  const provided = useContext(ThemeContext);
  const system = useColorScheme();
  return provided ?? (system === 'dark' ? 'dark' : 'light');
}
export function useTheme() {
  return theme[useThemeMode()];
}

export function GluestackUIProvider({ children }: { children: ReactNode }) {
  const mode = useColorScheme() === 'dark' ? 'dark' : 'light';
  return (
    <ThemeContext.Provider value={mode}>
      <View style={[{ flex: 1 }, vars(themeVariables(mode))]}>{children}</View>
    </ThemeContext.Provider>
  );
}
