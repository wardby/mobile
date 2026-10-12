import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as Native from 'react-native';
import { ExternalLink, NavigationRow, TextButton } from '../../src/ui/interactions';
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
  expect(screen.getByText('Pull request')).toHaveStyle({ color: '#0066cc' });
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
  expect(screen.getByText('Show more')).toHaveStyle({ color: '#0066cc' });
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
    expect(tint).toBe(mode === 'dark' ? '#66b2ff' : '#0066cc');
    const foreground = luminance(tint);
    const background = luminance(mode === 'dark' ? '#121212' : '#ffffff');
    expect(
      (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05),
    ).toBeGreaterThanOrEqual(4.5);
  });
});
