import { fireEvent, render, screen } from '@testing-library/react-native';
import Index from '../app/index';
import { useSession } from '../src/auth/session';

jest.mock('../src/auth/session', () => ({ useSession: jest.fn() }));
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text>{href}</Text>;
  },
}));
test('signed out opens Connect', async () => {
  (useSession as jest.Mock).mockReturnValue({ ready: true, status: 'signedOut' });
  await render(<Index />);
  expect(screen.getByText('/connect')).toBeTruthy();
});
test('signed in shows host and signs out', async () => {
  const signOut = jest.fn();
  (useSession as jest.Mock).mockReturnValue({
    ready: true,
    status: 'signedIn',
    host: 'https://server.example',
    signOut,
  });
  await render(<Index />);
  expect(screen.getByTestId('signed-in-host')).toHaveTextContent('server.example');
  await fireEvent.press(screen.getByTestId('sign-out'));
  expect(signOut).toHaveBeenCalled();
});
