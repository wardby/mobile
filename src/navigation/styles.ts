import { type ColorValue, Platform, PlatformColor, StyleSheet, useColorScheme } from 'react-native';

export function useColors() {
  const dark = useColorScheme() === 'dark';
  return {
    background: Platform.select<ColorValue>({
      ios: PlatformColor('systemBackground'),
      android: PlatformColor('?android:attr/colorBackground'),
      default: dark ? '#121212' : '#ffffff',
    }),
    text: Platform.select<ColorValue>({
      ios: PlatformColor('label'),
      android: PlatformColor('?android:attr/textColorPrimary'),
      default: dark ? '#ffffff' : '#000000',
    }),
    muted: Platform.select<ColorValue>({
      ios: PlatformColor('secondaryLabel'),
      android: PlatformColor('?android:attr/textColorSecondary'),
      default: dark ? '#888888' : '#767676',
    }),
    destructive: Platform.select<ColorValue>({
      ios: PlatformColor('systemRed'),
      android: PlatformColor('@android:color/holo_red_light'),
      default: dark ? '#ff453a' : '#ff3b30',
    }),
  };
}

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  title: { fontSize: 28, fontWeight: 'bold' },
  text: { fontSize: 17 },
  content: { padding: 24, gap: 32 },
  section: { gap: 12 },
  label: { fontSize: 13 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  button: { borderWidth: 1, borderRadius: 8, padding: 14, alignItems: 'center' },
});
