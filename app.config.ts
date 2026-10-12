import type { ExpoConfig } from 'expo/config';

import identity from './app.identity.ts';

const config: ExpoConfig = {
  name: identity.name,
  slug: identity.slug,
  scheme: identity.scheme,
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  ios: { bundleIdentifier: identity.iosBundleId },
  android: { package: identity.androidPackage },
  plugins: ['expo-router', 'expo-status-bar', 'expo-secure-store', 'expo-web-browser'],
  experiments: { typedRoutes: true },
  extra: identity.easProjectId ? { eas: { projectId: identity.easProjectId } } : {},
};

export default config;
