import { cssInterop, StyleSheet as InteropStyleSheet } from 'nativewind';
import { cssToReactNativeRuntime } from 'react-native-css-interop/css-to-rn';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import * as Native from 'react-native';
import { GluestackUIProvider } from '../../components/ui/provider';
import { theme, statusTokens } from '../../components/ui/theme';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { TextButton } from '../../components/ui/actions';
import { Link } from '../../components/ui/link';
import { Progress } from '../../components/ui/progress';
import { Text } from '../../components/ui/text';
import { useColors } from '../../src/navigation/styles';
import { statusStyle } from '../../src/runs/status';

jest.mock('react-native/Libraries/Components/View/ViewNativeComponent', () => ({
  ...jest.requireActual('react-native/Libraries/Components/View/ViewNativeComponent'),
  Commands: { hotspotUpdate: jest.fn(), setPressed: jest.fn() },
}));
beforeAll(() => {
  cssInterop(Native.View, { className: 'style' });
  cssInterop(Native.Text, { className: 'style' });
  InteropStyleSheet.registerCompiled(
    cssToReactNativeRuntime('.text-foreground { color: rgb(var(--color-foreground)); }'),
  );
});
afterEach(() => jest.restoreAllMocks());
beforeEach(() => {
  jest
    .spyOn(Native.AccessibilityInfo, 'isReduceMotionEnabled')
    .mockClear()
    .mockResolvedValue(false);
});

function Sample() {
  const colors = useColors();
  return (
    <>
      <Text testID="sample" style={{ color: colors.text }}>
        Theme
      </Text>
      <Text testID="token-sample" className="text-foreground">
        Token
      </Text>
    </>
  );
}

test.each(['light', 'dark'] as const)('provider follows the system in %s mode', async (mode) => {
  jest.spyOn(Native, 'useColorScheme').mockReturnValue(mode);
  await render(
    <GluestackUIProvider>
      <Sample />
    </GluestackUIProvider>,
  );
  expect(screen.getByTestId('sample')).toHaveStyle({ color: Native.PlatformColor('label') });
  expect(
    Native.processColor(
      Native.StyleSheet.flatten(screen.getByTestId('token-sample').props.style).color,
    ),
  ).toEqual(Native.processColor(theme[mode].text));
});

describe.each(['light', 'dark'] as const)('%s status badges', (mode) => {
  test('running has a non-interactive ring outside the pill', async () => {
    jest.spyOn(Native, 'useColorScheme').mockReturnValue(mode);
    await render(
      <GluestackUIProvider>
        <Badge testID="badge" status="running" />
      </GluestackUIProvider>,
    );
    const ring = screen.getByTestId('badge-pulse');
    expect(ring).toHaveStyle({
      position: 'absolute',
      top: -4,
      left: -4,
      right: -4,
      bottom: -4,
      borderRadius: 999,
      borderWidth: 4,
      borderColor: statusTokens.blue[mode].text,
    });
    expect(ring).toHaveProp('pointerEvents', 'none');
    expect(ring).toHaveProp('accessible', false);
  });

  test.each([
    ['running', 'Running', 'blue'],
    ['pending', 'Queued', 'blue'],
    ['succeeded', 'Succeeded', 'green'],
    ['failed', 'Failed', 'red'],
    ['lost', 'Lost', 'red'],
    ['budget_exhausted', 'Out of budget', 'orange'],
    ['refused', 'Refused', 'orange'],
    ['cancelled', 'Cancelled', 'grey'],
  ] as const)('%s uses the status label and theme token', async (status, label, tone) => {
    jest.spyOn(Native, 'useColorScheme').mockReturnValue(mode);
    await render(
      <GluestackUIProvider>
        <Badge testID="badge" status={status} />
      </GluestackUIProvider>,
    );
    expect(statusStyle(status)).toMatchObject({ label, tone });
    expect(screen.getByTestId('badge')).toHaveTextContent(label);
    expect(screen.getByTestId('badge')).toHaveStyle({
      backgroundColor: statusTokens[tone][mode].background,
    });
    expect(screen.getByText(label)).toHaveStyle({ color: statusTokens[tone][mode].text });
  });
});

test.each(['pending', 'succeeded'] as const)('%s has no pulse ring', async (status) => {
  await render(<Badge testID="badge" status={status} />);
  expect(screen.queryByTestId('badge-pulse')).toBeNull();
});

test('Reduce Motion suppresses the running pulse', async () => {
  jest.spyOn(Native.AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await render(<Badge testID="badge" status="running" />);
  expect(Native.AccessibilityInfo.isReduceMotionEnabled).toHaveBeenCalled();
  expect(screen.queryByTestId('badge-pulse')).toBeNull();
});

test('enabling Reduce Motion removes the pulse and cleans up the listener', async () => {
  const subscription = Native.AccessibilityInfo.addEventListener('reduceMotionChanged', () => {});
  const remove = jest.spyOn(subscription, 'remove');
  const listen = jest
    .spyOn(Native.AccessibilityInfo, 'addEventListener')
    .mockClear()
    .mockReturnValue(subscription);
  const view = await render(<Badge testID="badge" status="running" />);
  expect(screen.getByTestId('badge-pulse')).toBeTruthy();
  expect(listen).toHaveBeenCalledWith('reduceMotionChanged', expect.any(Function));
  const onChange = listen.mock.calls[0][1] as unknown as (enabled: boolean) => void;
  await act(() => onChange(true));
  expect(screen.queryByTestId('badge-pulse')).toBeNull();
  await view.unmount();
  expect(remove).toHaveBeenCalled();
});

test('running pulse loops two eased native one-second halves and stops on unmount', async () => {
  const start = jest.fn();
  const stop = jest.fn();
  const loop = jest.spyOn(Native.Animated, 'loop').mockReturnValue({
    start,
    stop,
    reset: jest.fn(),
  });
  const timing = jest.spyOn(Native.Animated, 'timing');
  const view = await render(<Badge testID="badge" status="running" />);
  expect(timing).toHaveBeenCalledTimes(2);
  for (const [index, toValue] of [0.35, 0].entries()) {
    expect(timing.mock.calls[index][1]).toEqual({
      toValue,
      duration: 1000,
      easing: expect.any(Function),
      useNativeDriver: true,
    });
    expect(timing.mock.calls[index][1].easing!(0.25)).toBeCloseTo(
      Native.Easing.inOut(Native.Easing.ease)(0.25),
    );
  }
  expect(loop).toHaveBeenCalledTimes(1);
  expect(start).toHaveBeenCalledTimes(1);
  await view.unmount();
  expect(stop).toHaveBeenCalledTimes(1);
});

test('Link exposes its browser semantics and opens the URL', async () => {
  const open = jest.spyOn(Native.Linking, 'openURL').mockResolvedValue(undefined);
  await render(<Link testID="link" label="Result" url="https://example.test/result" />);
  expect(screen.getByRole('link', { name: 'Result' })).toHaveProp(
    'accessibilityHint',
    'Opens in the browser',
  );
  await fireEvent.press(screen.getByTestId('link'));
  expect(open).toHaveBeenCalledWith('https://example.test/result');
});

test('Button preserves pressed feedback, target size and disabled state', async () => {
  const press = jest.fn();
  const view = await render(
    <Button testID="button" accessibilityLabel="Action" onPress={press}>
      <Text>Action</Text>
    </Button>,
  );
  expect(screen.getByTestId('button')).toHaveStyle({ minWidth: 44, minHeight: 44 });
  const event = { persist: jest.fn(), nativeEvent: { pageX: 0, pageY: 0 } };
  await fireEvent(screen.getByTestId('button'), 'responderGrant', event);
  expect(screen.getByTestId('button')).toHaveStyle({ opacity: 0.6 });
  await view.rerender(
    <Button testID="button" accessibilityLabel="Action" disabled onPress={press}>
      <Text>Action</Text>
    </Button>,
  );
  expect(screen.getByTestId('button')).toBeDisabled();
  expect(screen.getByTestId('button')).toHaveStyle({ opacity: 0.5 });
  await fireEvent.press(screen.getByTestId('button'));
  expect(press).not.toHaveBeenCalled();
});

test.each([true, false])(
  'TextButton selectedFill keeps its label on one line (selected: %s)',
  async (selected) => {
    await render(
      <TextButton testID="filter" label="Running" selectedFill accessibilityState={{ selected }} />,
    );
    expect(screen.getByText('Running')).toHaveProp('numberOfLines', 1);
    expect(screen.getByText('Running')).toHaveProp('adjustsFontSizeToFit', true);
    expect(screen.getByText('Running')).toHaveProp('minimumFontScale', 0.7);
  },
);

test('TextButton without selectedFill keeps its label wrapping', async () => {
  await render(<TextButton testID="range" label="Show last 24 hours" />);
  expect(screen.getByText('Show last 24 hours').props.numberOfLines).toBeUndefined();
  expect(screen.getByText('Show last 24 hours').props.adjustsFontSizeToFit).toBeUndefined();
  expect(screen.getByText('Show last 24 hours').props.minimumFontScale).toBeUndefined();
});

test.each(['ok', 'warn', 'over'] as const)('Progress uses the %s level token', async (level) => {
  await render(
    <Progress testID="progress" accessibilityLabel="Spend" ratio={0.75} level={level} />,
  );
  expect(screen.getByTestId('progress')).toHaveProp('accessibilityRole', 'progressbar');
  expect(screen.getByTestId('progress-fill')).toHaveStyle({
    width: '75%',
    backgroundColor: theme.light.progress[level],
  });
});
