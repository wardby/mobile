import { act, fireEvent, render } from '@testing-library/react-native';
import { Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import Settings from '../../app/(tabs)/settings';
import {
  applyAppearance,
  loadAppearance,
  saveAppearance,
  useAppearance,
} from '../../src/settings/appearance';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('../../src/auth/session', () => ({
  useSession: () => ({ host: 'https://server.example', signOut: jest.fn() }),
}));
beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
});
test.each([null, 'unknown', 'light', 'dark'])('loads %s with a System fallback', async (saved) => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValueOnce(saved);
  expect(await loadAppearance()).toBe(saved === 'light' || saved === 'dark' ? saved : 'system');
  expect(SecureStore.getItemAsync).toHaveBeenCalledWith('appearance');
});
test('read failure defaults to System', async () => {
  jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('unavailable'));
  expect(await loadAppearance()).toBe('system');
});
test.each(['light', 'dark', 'system'] as const)('applies %s to the whole app', (setting) => {
  applyAppearance(setting);
  expect(Appearance.setColorScheme).toHaveBeenCalledWith(
    setting === 'system' ? 'unspecified' : setting,
  );
});
test('saves the choice under its own key', async () => {
  await saveAppearance('dark');
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith('appearance', 'dark');
});
test('Settings restores the saved choice and applies, saves and shares changes immediately', async () => {
  jest.mocked(SecureStore.getItemAsync).mockResolvedValue('light');
  let other!: ReturnType<typeof useAppearance>;
  function OtherScreen() {
    other = useAppearance();
    return null;
  }
  const screen = await render(
    <>
      <Settings />
      <OtherScreen />
    </>,
  );
  expect(screen.getByText('APPEARANCE')).toBeTruthy();
  expect(screen.getByTestId('settings-appearance')).toHaveProp('accessibilityLabel', 'Appearance');
  for (const name of ['system', 'light', 'dark']) {
    expect(screen.getByTestId(`settings-appearance-${name}`)).toHaveProp(
      'accessibilityLabel',
      name[0].toUpperCase() + name.slice(1),
    );
    expect(screen.getByTestId(`settings-appearance-${name}`)).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: name === 'light' }),
    );
  }
  await fireEvent.press(screen.getByTestId('settings-appearance-dark'));
  expect(screen.getByTestId('settings-appearance-dark')).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ selected: true }),
  );
  expect(other.setting).toBe('dark');
  expect(Appearance.setColorScheme).toHaveBeenLastCalledWith('dark');
  expect(SecureStore.setItemAsync).toHaveBeenLastCalledWith('appearance', 'dark');
  await act(async () => {
    other.setSetting('system');
  });
  expect(screen.getByTestId('settings-appearance-system')).toHaveProp(
    'accessibilityState',
    expect.objectContaining({ selected: true }),
  );
  expect(Appearance.setColorScheme).toHaveBeenLastCalledWith('unspecified');
});

test('Settings fills only the selected appearance and moves the fill immediately', async () => {
  const screen = await render(<Settings />);
  expect(screen.getByTestId('settings-appearance-system').props.className).toContain('bg-accent');
  expect(screen.getByTestId('settings-appearance-light').props.className).not.toContain(
    'bg-accent',
  );
  expect(screen.getByTestId('settings-appearance-dark').props.className).not.toContain('bg-accent');

  await fireEvent.press(screen.getByTestId('settings-appearance-dark'));
  expect(screen.getByTestId('settings-appearance-dark').props.className).toContain('bg-accent');
  expect(screen.getByTestId('settings-appearance-system').props.className).not.toContain(
    'bg-accent',
  );
  expect(screen.getByTestId('settings-appearance-light').props.className).not.toContain(
    'bg-accent',
  );

  await fireEvent.press(screen.getByTestId('settings-appearance-light'));
  expect(screen.getByTestId('settings-appearance-light').props.className).toContain('bg-accent');
  expect(screen.getByTestId('settings-appearance-system').props.className).not.toContain(
    'bg-accent',
  );
  expect(screen.getByTestId('settings-appearance-dark').props.className).not.toContain('bg-accent');
});

test('web can launch when Appearance has no native override API', () => {
  const native = Appearance.setColorScheme;
  Object.defineProperty(Appearance, 'setColorScheme', { value: undefined, configurable: true });
  try {
    expect(() => applyAppearance('system')).not.toThrow();
  } finally {
    Object.defineProperty(Appearance, 'setColorScheme', { value: native, configurable: true });
  }
});
