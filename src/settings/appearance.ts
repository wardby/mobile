import { useEffect, useSyncExternalStore } from 'react';
import { Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export type AppearanceSetting = 'system' | 'light' | 'dark';
const key = 'appearance';
let setting: AppearanceSetting = 'system';
let initialization: Promise<void> | null = null;
const listeners = new Set<() => void>();
const update = (next: AppearanceSetting) => {
  setting = next;
  listeners.forEach((listener) => listener());
};
export async function loadAppearance(): Promise<AppearanceSetting> {
  try {
    const saved = await SecureStore.getItemAsync(key);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}
export function saveAppearance(setting: AppearanceSetting) {
  return SecureStore.setItemAsync(key, setting);
}
export function applyAppearance(setting: AppearanceSetting) {
  // React Native Web does not expose the native app appearance override.
  Appearance.setColorScheme?.(setting === 'system' ? 'unspecified' : setting);
}
export function initializeAppearance() {
  if (!initialization)
    initialization = loadAppearance().then((saved) => {
      applyAppearance(saved);
      update(saved);
    });
  return initialization;
}
function setSetting(next: AppearanceSetting) {
  applyAppearance(next);
  update(next);
  void saveAppearance(next).catch(() => {
    // Keep the current appearance if storage is unavailable.
  });
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
const getSnapshot = () => setting;
export function useAppearance() {
  const setting = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    void initializeAppearance();
  }, []);
  return { setting, setSetting };
}
