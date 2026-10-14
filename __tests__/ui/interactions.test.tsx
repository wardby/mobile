import tailwindConfig from '../../tailwind.config';
import * as ThemeProvider from '../../components/ui/provider';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import * as Icons from '../../components/ui/icon';
import { theme, themeVariables } from '../../components/ui/theme';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Native from 'react-native';
import { ExternalLink, MenuButton, NavigationRow, TextButton } from '../../src/ui/interactions';
import { useColors } from '../../src/navigation/styles';

// Jest's native View mock omits the Android ripple commands.
jest.mock('react-native/Libraries/Components/View/ViewNativeComponent', () => ({
  ...jest.requireActual('react-native/Libraries/Components/View/ViewNativeComponent'),
  Commands: { hotspotUpdate: jest.fn(), setPressed: jest.fn() },
}));

async function expectFeedback(id: string) {
  const control = screen.getByTestId(id);
  expect(control).toHaveProp(
    'nativeBackgroundAndroid',
    expect.objectContaining({ type: 'RippleAndroid', color: expect.any(Number) }),
  );
  const event = { persist: jest.fn(), nativeEvent: { pageX: 0, pageY: 0 } };
  await fireEvent(control, 'responderGrant', event);
  expect(screen.getByTestId(id)).toHaveStyle({ opacity: 0.6 });
  await fireEvent(screen.getByTestId(id), 'responderTerminate', event);
  await waitFor(() => expect(screen.getByTestId(id)).toHaveStyle({ opacity: 1 }));
}

beforeEach(() => jest.replaceProperty(Native.Platform, 'OS', 'android'));
afterEach(() => jest.restoreAllMocks());

test('external links have a link role, browser hint, accent, external marker and pressed feedback', async () => {
  const open = jest.spyOn(Native.Linking, 'openURL').mockResolvedValue(undefined);
  await render(<ExternalLink testID="link" label="Pull request" url="https://example.test/pr/1" />);
  expect(screen.getByRole('link', { name: 'Pull request' })).toBeTruthy();
  expect(screen.getByTestId('link')).toHaveProp('accessibilityHint', 'Opens in the browser');
  expect(screen.getByText('Pull request')).toHaveStyle({ color: theme.light.tint });
  expect(screen.getByTestId('link')).toHaveTextContent(/↗/);
  expect(screen.getByTestId('link')).not.toHaveTextContent(/›/);
  await expectFeedback('link');
  await fireEvent.press(screen.getByTestId('link'));
  expect(open).toHaveBeenCalledWith('https://example.test/pr/1');
});

test('navigation rows label the full-row button, have a trailing chevron and pressed feedback', async () => {
  const press = jest.fn();
  await render(
    <NavigationRow testID="row" accessibilityLabel="Open run" onPress={press}>
      <Native.Text>Run</Native.Text>
    </NavigationRow>,
  );
  expect(screen.getByRole('button', { name: 'Open run' })).toBeTruthy();
  expect(screen.getByTestId('row')).toHaveTextContent(/Run›$/);
  await expectFeedback('row');
  await fireEvent.press(screen.getByTestId('row'));
  expect(press).toHaveBeenCalledTimes(1);
});

test('text buttons expose expanded state, flip disclosure, meet target size and show pressed feedback', async () => {
  const press = jest.fn();
  const view = await render(
    <TextButton testID="toggle" label="Show more" expanded={false} onPress={press} />,
  );
  expect(screen.getByRole('button', { name: 'Show more' })).toBeTruthy();
  expect(screen.getByTestId('toggle')).toHaveStyle({ minWidth: 44, minHeight: 44 });
  expect(screen.getByTestId('toggle')).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ expanded: false }),
  );
  expect(screen.getByText('Show more')).toHaveStyle({ color: theme.light.tint });
  expect(screen.getByTestId('toggle')).toHaveTextContent(/▾/);
  await expectFeedback('toggle');
  await fireEvent.press(screen.getByTestId('toggle'));
  expect(press).toHaveBeenCalledTimes(1);
  await view.rerender(<TextButton testID="toggle" label="Show less" expanded onPress={press} />);
  expect(screen.getByTestId('toggle')).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ expanded: true }),
  );
  expect(screen.getByTestId('toggle')).toHaveTextContent(/▴/);
});

test('text buttons preserve selected and disabled states and omit disclosure for ordinary actions', async () => {
  const press = jest.fn();
  await render(
    <TextButton
      testID="action"
      label="All"
      accessibilityState={{ selected: true }}
      disabled
      onPress={press}
    />,
  );
  expect(screen.getByTestId('action')).toBeDisabled();
  expect(screen.getByTestId('action')).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ selected: true, disabled: true }),
  );
  expect(screen.getByTestId('action')).not.toHaveTextContent(/[›▾▴]/);
  await fireEvent.press(screen.getByTestId('action'));
  expect(press).not.toHaveBeenCalled();
});

test.each([false, true])('caller opacity wins when disabled is %s', async (disabled) => {
  await render(
    <TextButton testID="opacity" label="Action" disabled={disabled} style={{ opacity: 0.3 }} />,
  );
  expect(screen.getByTestId('opacity')).toHaveStyle({ opacity: 0.3 });
  if (!disabled) {
    const event = { persist: jest.fn(), nativeEvent: { pageX: 0, pageY: 0 } };
    await fireEvent(screen.getByTestId('opacity'), 'responderGrant', event);
    expect(screen.getByTestId('opacity')).toHaveStyle({ opacity: 0.3 });
  }
});

function luminance(hex: string) {
  const values = hex
    .slice(1)
    .match(/../g)!
    .map((value) => {
      const channel = parseInt(value, 16) / 255;
      return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
    });
  return values[0] * 0.2126 + values[1] * 0.7152 + values[2] * 0.0722;
}

describe.each(['ios', 'android', 'web'] as const)('%s accent', (platform) => {
  test.each(['light', 'dark'] as const)('meets AA against the %s background', async (mode) => {
    jest.replaceProperty(Native.Platform, 'OS', platform);
    jest.spyOn(Native, 'useColorScheme').mockReturnValue(mode);
    function Sample() {
      return (
        <Native.Text testID="accent" style={{ color: useColors().tint }}>
          Link
        </Native.Text>
      );
    }
    await render(<Sample />);
    const tint = Native.StyleSheet.flatten(screen.getByTestId('accent').props.style)
      .color as string;
    expect(tint).toBe(theme[mode].tint);
    const foreground = luminance(tint);
    const background = luminance(theme[mode].background);
    expect(
      (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
    ).toBeGreaterThanOrEqual(4.5);
  });
});

test.each(['light', 'dark'] as const)(
  'menu button appearance and interaction in %s mode',
  async (mode) => {
    jest.spyOn(Native, 'useColorScheme').mockReturnValue(mode);
    const colors = theme[mode];
    const icon = jest.spyOn(Icons, 'Icon');
    jest.spyOn(ThemeProvider, 'useTheme').mockReturnValue(colors);
    const press = jest.fn();
    const view = await render(
      <MenuButton
        testID="menu"
        label="All agents"
        expanded={false}
        active={false}
        accessibilityLabel="Agent, All agents"
        accessibilityHint="Opens the agent menu"
        onPress={press}
      />,
    );
    expect(screen.getByRole('button', { name: 'Agent, All agents' })).toBeTruthy();
    expect(screen.getByTestId('menu')).toHaveProp('accessibilityHint', 'Opens the agent menu');
    expect(screen.getByTestId('menu')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ expanded: false, disabled: false }),
    );
    expect(screen.getByTestId('menu')).toHaveStyle({ minHeight: 44 });
    expect(screen.getByTestId('menu').props.className.split(' ')).toEqual(
      expect.arrayContaining(['border', 'border-border', 'bg-fill', 'rounded-lg']),
    );
    expect(screen.getByTestId('menu').props.className).toContain('rounded-lg');
    expect(screen.getByTestId('menu').props.className).toContain('px-3');
    expect(screen.getByText('All agents')).toHaveStyle({ color: colors.text });
    expect(screen.getByText('All agents')).toHaveProp('numberOfLines', 1);
    expect(icon).toHaveBeenLastCalledWith(expect.objectContaining({ as: ChevronDown }), undefined);
    expect(icon).toHaveBeenLastCalledWith(expect.objectContaining({ size: 17 }), undefined);
    expect(icon).toHaveBeenLastCalledWith(
      expect.objectContaining({ color: colors.muted }),
      undefined,
    );
    expect(screen.getByTestId('menu')).not.toHaveTextContent(/[▾▴]/);
    await expectFeedback('menu');
    await fireEvent.press(screen.getByTestId('menu'));
    expect(press).toHaveBeenCalledTimes(1);
    await view.rerender(
      <MenuButton
        testID="menu"
        label="Builder"
        expanded
        active
        disabled
        accessibilityState={{ selected: true }}
        onPress={press}
      />,
    );
    expect(screen.getByTestId('menu').props.className.split(' ')).toEqual(
      expect.arrayContaining(['border', 'border-accent', 'bg-fill', 'rounded-lg']),
    );
    expect(screen.getByTestId('menu').props.className.split(' ')).not.toContain('border-border');
    expect(screen.getByText('Builder')).toHaveStyle({ color: colors.tint });
    expect(icon).toHaveBeenLastCalledWith(expect.objectContaining({ as: ChevronUp }), undefined);
    expect(screen.getByTestId('menu')).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ expanded: true, disabled: true, selected: true }),
    );
    await fireEvent.press(screen.getByTestId('menu'));
    expect(press).toHaveBeenCalledTimes(1);
  },
);

test.each([
  ['light', '#f2f2f7', '242 242 247'],
  ['dark', '#2c2c2e', '44 44 46'],
] as const)(
  'fill token is available through the theme and colors in %s mode',
  async (mode, fill, variable) => {
    jest.spyOn(Native, 'useColorScheme').mockReturnValue(mode);
    expect(theme[mode].fill).toBe(fill);
    expect(themeVariables(mode)['--color-fill']).toBe(variable);
    function Sample() {
      return <Native.View testID="fill" style={{ backgroundColor: useColors().fill }} />;
    }
    await render(<Sample />);
    expect(screen.getByTestId('fill')).toHaveStyle({ backgroundColor: fill });
  },
);

test.each([false, true])(
  'menu button omits inline border and fill when active is %s',
  async (active) => {
    await render(<MenuButton testID="menu" label="Agent" expanded={false} active={active} />);
    const style = Native.StyleSheet.flatten(screen.getByTestId('menu').props.style);
    for (const property of ['borderWidth', 'borderColor', 'backgroundColor']) {
      expect(style).not.toHaveProperty(property);
    }
  },
);

test('selected text button uses accent fill without an inline underline', async () => {
  await render(
    <TextButton
      testID="selected"
      label="All"
      selectedFill
      accessibilityState={{ selected: true }}
    />,
  );
  expect(screen.getByTestId('selected').props.className.split(' ')).toContain('bg-accent');
  const style = Native.StyleSheet.flatten(screen.getByTestId('selected').props.style);
  expect(style).not.toHaveProperty('borderBottomWidth');
  expect(style).not.toHaveProperty('borderBottomColor');
});

test('Tailwind exposes the fill theme token', () => {
  expect(tailwindConfig.theme.extend.colors.fill).toBe('rgb(var(--color-fill) / <alpha-value>)');
});
