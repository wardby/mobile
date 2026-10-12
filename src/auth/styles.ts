import { PlatformColor, StyleSheet, useColorScheme } from 'react-native';
export function useColors() {
  const dark = useColorScheme() === 'dark';
  return {
    background:
      process.env.EXPO_OS === 'ios'
        ? PlatformColor('systemBackground')
        : dark
          ? '#121212'
          : '#ffffff',
    text: process.env.EXPO_OS === 'ios' ? PlatformColor('label') : dark ? '#ffffff' : '#000000',
    border: dark ? '#888888' : '#767676',
  };
}
export const styles = StyleSheet.create({
  keyboard: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 24 },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 17 },
  button: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  disabled: { opacity: 0.5 },
  text: { fontSize: 17 },
});
