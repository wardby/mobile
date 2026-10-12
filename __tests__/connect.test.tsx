import { fireEvent, render, screen } from '@testing-library/react-native';
import Connect from '../app/connect';
import { useSession } from '../src/auth/session';
import { AuthError, messages } from '../src/auth/errors';

jest.mock('../src/auth/session', () => ({ useSession: jest.fn() }));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ replace: mockReplace }) }));
const signIn = jest.fn();
const clearError = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  signIn.mockResolvedValue(undefined);
  (useSession as jest.Mock).mockReturnValue({
    status: 'signedOut',
    signIn,
    clearError,
    error: null,
  });
});
test('renders host helper and disables empty submit', async () => {
  await render(<Connect />);
  expect(screen.getByText('Your own wardby server')).toBeTruthy();
  expect(screen.getByTestId('connect-submit')).toBeDisabled();
  expect(screen.getByTestId('connect-host').props).toMatchObject({
    placeholder: 'wardby.example.com',
    keyboardType: 'url',
    autoCapitalize: 'none',
    autoCorrect: false,
  });
});
test.each(Object.keys(messages) as (keyof typeof messages)[])(
  'shows exact %s error and clears on edit',
  async (code) => {
    (useSession as jest.Mock).mockReturnValue({
      status: 'signedOut',
      signIn,
      clearError,
      error: new AuthError(code),
    });
    await render(<Connect />);
    expect(screen.getByTestId('connect-error')).toHaveTextContent(messages[code]);
    await fireEvent.changeText(screen.getByTestId('connect-host'), 'server.example');
    expect(clearError).toHaveBeenCalled();
  },
);
test('success navigates after submitting host', async () => {
  await render(<Connect />);
  await fireEvent.changeText(screen.getByTestId('connect-host'), 'server.example');
  await fireEvent.press(screen.getByTestId('connect-submit'));
  expect(signIn).toHaveBeenCalledWith('server.example');
  expect(mockReplace).toHaveBeenCalledWith('/');
});
test('Return submits host', async () => {
  await render(<Connect />);
  await fireEvent.changeText(screen.getByTestId('connect-host'), 'server.example');
  await fireEvent(screen.getByTestId('connect-host'), 'submitEditing');
  expect(signIn).toHaveBeenCalledWith('server.example');
});
test('signing in shows loading label and disables button', async () => {
  (useSession as jest.Mock).mockReturnValue({
    status: 'signingIn',
    signIn,
    clearError,
    error: null,
  });
  await render(<Connect />);
  expect(screen.getByText('Signing in…')).toBeTruthy();
  expect(screen.getByTestId('connect-submit')).toBeDisabled();
});
