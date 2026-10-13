import { act, render } from '@testing-library/react-native';
import { Appearance } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import RootLayout from '../../app/_layout';

jest.mock('expo-secure-store', () => ({ getItemAsync: jest.fn() }));
jest.mock('../../src/auth/session', () => ({
  useSession: () => ({ ready: true, status: 'signedIn' }),
}));
jest.mock('../../src/live/useLiveGraph', () => ({
  LiveGraphProvider: ({ children }: { children: React.ReactNode }) => children,
}));
const mockFirstScreen = jest.fn();
jest.mock('expo-router', () => {
  const Stack = ({ children }: { children: React.ReactNode }) => children;
  Stack.Protected = function Protected({ children }: { children: React.ReactNode }) {
    return children;
  };
  Stack.Screen = function Screen() {
    mockFirstScreen();
    return null;
  };
  return { Stack };
});
test('launch stays blank until saved Light is applied before the first screen', async () => {
  let resolve!: (setting: string) => void;
  jest.mocked(SecureStore.getItemAsync).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const apply = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
  const result = await render(<RootLayout />);
  expect(result.toJSON()).toBeNull();
  expect(mockFirstScreen).not.toHaveBeenCalled();
  await act(async () => {
    resolve('light');
  });
  expect(apply).toHaveBeenCalledWith('light');
  expect(mockFirstScreen).toHaveBeenCalled();
  expect(apply.mock.invocationCallOrder[0]).toBeLessThan(
    mockFirstScreen.mock.invocationCallOrder[0],
  );
});
