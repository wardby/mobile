import type { ExpoConfig } from 'expo/config';

import identity from './app.identity.ts';
import { theme } from './components/ui/theme.ts';

const config: ExpoConfig = {
  name: identity.name,
  slug: identity.slug,
  scheme: identity.scheme,
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',
  ios: {
    bundleIdentifier: identity.iosBundleId,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: identity.androidPackage,
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#071d3b',
      monochromeImage: './assets/images/monochrome-icon.png',
    },
  },
  web: { favicon: './assets/images/favicon.png' },
  plugins: [
    'expo-router',
    'expo-status-bar',
    'expo-secure-store',
    'expo-web-browser',
    [
      'expo-splash-screen',
      {
        image: './assets/images/splash-mascot.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: theme.light.background,
        dark: { image: './assets/images/splash-mascot.png', backgroundColor: '#071d3b' },
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: identity.easProjectId ? { eas: { projectId: identity.easProjectId } } : {},
};

export default config;
