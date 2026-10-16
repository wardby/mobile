import config from '../app.config';
import identity, { redirectUri } from '../app.identity';

describe('redirectUri', () => {
  it('returns the default OAuth redirect', () => {
    expect(redirectUri()).toBe('com.wardby.mobile:/oauth');
  });
});

describe('EAS project identity', () => {
  it('exposes the configured project ID from the identity', () => {
    const { easProjectId } = identity;
    expect(easProjectId).toBe('1d693772-46a8-4b89-a9f1-f0db791473cf');
    expect(config.extra?.eas.projectId).toBe(easProjectId);
  });

  it('omits extra.eas when the identity project ID is undefined', () => {
    jest.isolateModules(() => {
      jest.doMock('../app.identity.ts', () => ({
        __esModule: true,
        default: { ...identity, easProjectId: undefined },
      }));

      const configWithoutProject = jest.requireActual('../app.config').default;
      expect(configWithoutProject.extra).not.toHaveProperty('eas');
    });
    jest.dontMock('../app.identity.ts');
  });
});

describe('TestFlight branding', () => {
  it('declares exempt encryption', () => {
    expect(config.ios?.infoPlist?.ITSAppUsesNonExemptEncryption).toBe(false);
  });
  it('configures PNG icons on every platform', () => {
    expect(config.icon).toBe('./assets/images/icon.png');
    expect(config.android?.adaptiveIcon).toEqual({
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#071d3b',
      monochromeImage: './assets/images/monochrome-icon.png',
    });
    expect(config.web?.favicon).toBe('./assets/images/favicon.png');
  });
  it('uses the local mascot on light and dark splash backgrounds', () => {
    expect(config.plugins).toContainEqual([
      'expo-splash-screen',
      {
        image: './assets/images/splash-mascot.png',
        imageWidth: 200,
        resizeMode: 'contain',
        backgroundColor: '#ffffff',
        dark: { image: './assets/images/splash-mascot.png', backgroundColor: '#071d3b' },
      },
    ]);
  });
});
