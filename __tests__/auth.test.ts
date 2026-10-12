import * as SecureStore from 'expo-secure-store';
import * as AuthSession from 'expo-auth-session';
import fixtures from './fixtures/oauth.json';
import { discover, normalizeHost } from '../src/auth/discovery';
import { register } from '../src/auth/register';
import { act, renderHook } from '@testing-library/react-native';
import { createSession, session, useSession } from '../src/auth/session';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA256' },
  digestStringAsync: jest.fn(async (_algorithm, value) => encodeURIComponent(value)),
}));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));
jest.mock('expo-web-browser', () => ({ maybeCompleteAuthSession: jest.fn() }));
jest.mock('expo-auth-session', () => ({
  AuthRequest: jest.fn().mockImplementation(() => ({
    codeVerifier: 'fake-verifier',
    promptAsync: jest.fn().mockResolvedValue({ type: 'success', params: { code: 'fake-code' } }),
  })),
  ResponseType: { Code: 'code' },
}));
const fetchMock = jest.fn();
const reply = (body: unknown, status = 200) =>
  fetchMock.mockResolvedValueOnce({ ok: status === 200, status, json: async () => body });
beforeEach(() => {
  jest.clearAllMocks();
  fetchMock.mockReset();
  globalThis.fetch = fetchMock;
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue(null);
});
async function config() {
  reply(fixtures.resource);
  reply(fixtures.metadata);
  return discover('server.example');
}
async function signedIn() {
  const session = createSession();
  reply(fixtures.resource);
  reply(fixtures.metadata);
  reply(fixtures.client);
  reply(fixtures.tokens);
  await session.signIn('server.example');
  return session;
}

test('normalizes hosts and restricts insecure origins', () => {
  expect(normalizeHost(' server.example/path ')).toBe('https://server.example');
  for (const host of ['localhost', '127.0.0.1', '10.0.2.2', '192.168.1.2', '172.16.1.2'])
    expect(normalizeHost(`http://${host}:3000`)).toBe(`http://${host}:3000`);
  for (const host of [
    'http://server.example',
    'http://172.32.1.2',
    'ftp://localhost',
    'https://user:pass@server.example',
  ])
    expect(() => normalizeHost(host)).toThrow();
});
test('discovers metadata', async () => {
  expect((await config()).resource).toBe(fixtures.resource.resource);
});
test.each([{}, { authorization_endpoint: 'https://server.example' }])(
  'rejects missing metadata fields %j',
  async (metadata) => {
    reply(fixtures.resource);
    reply(metadata);
    await expect(discover('server.example')).rejects.toMatchObject({ code: 'not_wardby' });
  },
);
test('rejects missing admin:view', async () => {
  reply(fixtures.resource);
  reply({ ...fixtures.metadata, scopes_supported: [] });
  await expect(discover('server.example')).rejects.toMatchObject({
    code: 'admin_view_unsupported',
  });
});
test('maps unreachable servers', async () => {
  fetchMock.mockRejectedValueOnce(new Error());
  await expect(discover('server.example')).rejects.toMatchObject({ code: 'unreachable' });
});
test('registers a public client and caches per host', async () => {
  const c = await config();
  reply(fixtures.client);
  expect(await register(c)).toBe('test-client');
  expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toMatchObject({
    token_endpoint_auth_method: 'none',
    redirect_uris: ['com.wardby.mobile:/oauth'],
  });
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValue('cached-client');
  expect(await register(c)).toBe('cached-client');
  expect(SecureStore.setItemAsync).toHaveBeenCalled();
});
test('maps disabled mobile registration', async () => {
  const c = await config();
  reply({ error: 'invalid_redirect_uri', error_description: 'mobile_disabled' }, 400);
  await expect(register(c)).rejects.toMatchObject({ code: 'mobile_disabled' });
});
test('code exchange stores tokens and requests PKCE scopes and resource', async () => {
  const s = await signedIn();
  expect(await s.getAccessToken()).toBe('fake-access');
  expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
    'wardby.session',
    expect.stringContaining('fake-access'),
  );
  expect(AuthSession.AuthRequest).toHaveBeenCalledWith(
    expect.objectContaining({
      usePKCE: true,
      scopes: ['admin:view', 'offline_access'],
      extraParams: { resource: fixtures.resource.resource },
    }),
  );
});
test('refreshes near expiry with one shared request', async () => {
  const s = await signedIn();
  jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 550000);
  reply({ ...fixtures.tokens, access_token: 'fake-new' });
  expect(await Promise.all([s.getAccessToken(), s.getAccessToken()])).toEqual([
    'fake-new',
    'fake-new',
  ]);
  expect(fetchMock).toHaveBeenCalledTimes(5);
  jest.restoreAllMocks();
});
test.each(['invalid_grant', 'mobile_disabled'])(
  'failed refresh %s clears session',
  async (error) => {
    const s = await signedIn();
    jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 550000);
    reply({ error }, 400);
    expect(await s.getAccessToken()).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('wardby.session');
    jest.restoreAllMocks();
  },
);
test.each([200, 500])('sign-out revokes and clears even on status %s', async (status) => {
  const s = await signedIn();
  reply({}, status);
  await s.signOut();
  expect(fetchMock.mock.calls[4][0]).toBe(fixtures.metadata.revocation_endpoint);
  expect(await s.getAccessToken()).toBeNull();
});
test('API unauthorized signs out', async () => {
  const s = await signedIn();
  reply({ error: 'invalid_token' }, 401);
  reply({});
  await expect(s.apiClient()!.getInfra()).rejects.toThrow();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(await s.getAccessToken()).toBeNull();
});

test('missing scopes metadata is not a wardby contract', async () => {
  reply(fixtures.resource);
  const metadata: Partial<typeof fixtures.metadata> = { ...fixtures.metadata };
  delete metadata.scopes_supported;
  reply(metadata);
  await expect(discover('server.example')).rejects.toMatchObject({ code: 'not_wardby' });
});

test('registration caches independently for each host', async () => {
  const stored = new Map<string, string>();
  (SecureStore.getItemAsync as jest.Mock).mockImplementation(
    async (key) => stored.get(key) ?? null,
  );
  (SecureStore.setItemAsync as jest.Mock).mockImplementation(async (key, value) => {
    stored.set(key, value);
  });
  const c = await config();
  reply({ client_id: 'client-one' });
  expect(await register(c)).toBe('client-one');
  reply({ client_id: 'client-two' });
  expect(await register({ ...c, host: 'https://other.example' })).toBe('client-two');
  expect(await register(c)).toBe('client-one');
  expect(stored.size).toBe(2);
  (SecureStore.setItemAsync as jest.Mock).mockReset();
});
test('restores secure session and refreshes after restart', async () => {
  (SecureStore.getItemAsync as jest.Mock).mockResolvedValueOnce(
    JSON.stringify({
      host: 'https://server.example',
      clientId: 'test-client',
      accessToken: 'fake-old',
      refreshToken: 'fake-refresh',
      expiresAt: Date.now(),
    }),
  );
  const s = createSession();
  reply(fixtures.resource);
  reply(fixtures.metadata);
  reply(fixtures.tokens);
  expect(await s.getAccessToken()).toBe('fake-access');
  expect(s.getSnapshot()).toMatchObject({
    status: 'signedIn',
    host: 'https://server.example',
    ready: true,
  });
});
test('sign-out clears on revocation network failure', async () => {
  const s = await signedIn();
  fetchMock.mockRejectedValueOnce(new Error());
  await s.signOut();
  expect(await s.getAccessToken()).toBeNull();
});
test('useSession exposes loading, host, errors and sign-out updates', async () => {
  const { result } = await renderHook(() => useSession());
  expect(result.current.status).toBe('signedOut');
  reply(fixtures.resource);
  reply({ ...fixtures.metadata, scopes_supported: ['admin:view'] });
  reply(fixtures.client);
  reply(fixtures.tokens);
  let pending!: Promise<void>;
  await act(async () => {
    pending = result.current.signIn('server.example');
    await pending;
  });
  expect(result.current).toMatchObject({ status: 'signedIn', host: 'https://server.example' });
  expect(AuthSession.AuthRequest).toHaveBeenLastCalledWith(
    expect.objectContaining({ scopes: ['admin:view'] }),
  );
  reply({});
  await act(async () => {
    await result.current.signOut();
  });
  expect(result.current.status).toBe('signedOut');
  await act(async () => {
    await session.signIn('http://public.example').catch(() => {});
  });
  expect(result.current.error?.code).toBe('invalid_host');
  await act(async () => {
    result.current.clearError();
  });
  expect(result.current.error).toBeNull();
});

test('disabled sign-in error carries explicit operator setting', async () => {
  const c = await config();
  reply({ error: 'invalid_redirect_uri', error_description: 'mobile_disabled' }, 400);
  await expect(register(c)).rejects.toThrow('WARDBY_MOBILE_ENABLED=true');
});
