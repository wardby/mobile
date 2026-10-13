import { cssInterop, StyleSheet as InteropStyleSheet } from 'nativewind';
import { cssToReactNativeRuntime } from 'react-native-css-interop/css-to-rn';
import { fireEvent, render, screen } from '@testing-library/react-native';
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
