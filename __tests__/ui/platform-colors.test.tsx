import { render, screen } from '@testing-library/react-native';
import * as Native from 'react-native';
import { useColors } from '../../src/navigation/styles';
import { useColors as useAuthColors } from '../../src/auth/styles';
import { theme } from '../../components/ui/theme';

function Sample() {
  const colors = useColors();
  const auth = useAuthColors();
  return (
    <>
      <Native.View testID="navigation" style={{ backgroundColor: colors.background }}>
        <Native.Text testID="text" style={{ color: colors.text }} />
        <Native.Text testID="muted" style={{ color: colors.muted }} />
        <Native.Text testID="destructive" style={{ color: colors.destructive }} />
      </Native.View>
      <Native.View testID="auth" style={{ backgroundColor: auth.background }} />
    </>
  );
}

afterEach(() => jest.restoreAllMocks());

test.each([
  ['ios', 'systemBackground', 'label', 'secondaryLabel', 'systemRed'],
  [
    'android',
    '?android:attr/colorBackground',
    '?android:attr/textColorPrimary',
    '?android:attr/textColorSecondary',
    '?android:attr/colorError',
  ],
] as const)(
  '%s uses system colours for navigation and auth',
  async (platform, background, text, muted, destructive) => {
    jest.replaceProperty(Native.Platform, 'OS', platform);
    await render(<Sample />);
    expect(screen.getByTestId('navigation')).toHaveStyle({
      backgroundColor: Native.PlatformColor(background),
    });
    expect(screen.getByTestId('auth')).toHaveStyle({
      backgroundColor: Native.PlatformColor(background),
    });
    for (const [id, name] of [
      ['text', text],
      ['muted', muted],
      ['destructive', destructive],
    ]) {
      expect(screen.getByTestId(id)).toHaveStyle({ color: Native.PlatformColor(name) });
    }
  },
);

test.each(['light', 'dark'] as const)('web retains %s theme tokens', async (mode) => {
  jest.replaceProperty(Native.Platform, 'OS', 'web');
  jest.spyOn(Native, 'useColorScheme').mockReturnValue(mode);
  await render(<Sample />);
  expect(screen.getByTestId('navigation')).toHaveStyle({ backgroundColor: theme[mode].background });
  expect(screen.getByTestId('text')).toHaveStyle({ color: theme[mode].text });
});
