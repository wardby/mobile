import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import dockerFixture from '../../src/api/__fixtures__/infra.json';
import kubernetesFixture from '../../src/api/__fixtures__/infra-kubernetes.json';
import invalidToken from '../../src/api/__fixtures__/invalid_token.json';
import internalError from '../../src/api/__fixtures__/internal_error.json';
import { ApiError, createApiClient } from '../../src/api/client';
import type { components } from '../../src/api/schema';
import { session } from '../../src/auth/session';
import { useInfra } from '../../src/infra/useInfra';

let mockFocus: () => void;
let mockBlur: () => void;
jest.mock('expo-router', () => ({
  useFocusEffect: (callback: () => void | (() => void)) => {
    const React = jest.requireActual('react');
    React.useEffect(() => {
      const cleanups: (void | (() => void))[] = [];
      // Like expo-router, a focus always follows the previous blur's cleanup.
      mockFocus = () => {
        mockBlur();
        cleanups.push(callback());
      };
      mockBlur = () => {
        for (const cleanup of cleanups.splice(0)) cleanup?.();
      };
      mockFocus();
      return () => mockBlur();
    }, [callback]);
  },
}));
jest.mock('../../src/auth/session', () => ({ session: { apiClient: jest.fn() } }));

type Infra = components['schemas']['infra-info'];
const docker = dockerFixture as Infra;
const kubernetes = kubernetesFixture as Infra;
let view: Awaited<ReturnType<typeof renderHook<ReturnType<typeof useInfra>, unknown>>>;
const current = () => view.result.current;
let getInfra: jest.Mock;
let handlers: ((state: AppStateStatus) => void)[];
let remove: jest.Mock;
const appState = (state: AppStateStatus) => {
  for (const handler of handlers) handler(state);
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
// A real client answering every request with the recorded fixture and status.
function fixtureClient(status: number, body: unknown, onUnauthorized = jest.fn()) {
  const client = createApiClient({
    baseUrl: 'https://example.invalid',
    getAccessToken: () => null,
    onUnauthorized,
    fetch: jest.fn(async () => new Response(JSON.stringify(body), { status })),
  });
  return { client, onUnauthorized };
}
async function errorFor(status: number, body: unknown) {
  return fixtureClient(status, body)
    .client.getInfra()
    .catch((e: unknown) => e as ApiError);
}
const mount = async () => {
  view = await renderHook(() => useInfra());
  return view;
};

beforeEach(() => {
  jest.clearAllMocks();
  getInfra = jest.fn().mockResolvedValue(docker);
  (session.apiClient as jest.Mock).mockReturnValue({ getInfra });
  handlers = [];
  remove = jest.fn();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((type, handler) => {
    const listener = handler as (state: AppStateStatus) => void;
    if (type === 'change') handlers.push(listener);
    return {
      remove: () => {
        remove();
        handlers = handlers.filter((item) => item !== listener);
      },
    };
  });
});
afterEach(() => jest.restoreAllMocks());

test('loads once on mount, with loading true and then false', async () => {
  const pending = deferred<Infra>();
  getInfra.mockReturnValueOnce(pending.promise);
  await mount();
  expect(getInfra).toHaveBeenCalledTimes(1);
  expect(current().loading).toBe(true);
  expect(current().infra).toBeNull();
  await act(async () => pending.resolve(docker));
  expect(current()).toMatchObject({ infra: docker, loading: false, error: null });
  expect(getInfra).toHaveBeenCalledTimes(1);
});
test('a missing client is a network error', async () => {
  (session.apiClient as jest.Mock).mockReturnValue(null);
  await mount();
  await waitFor(() => expect(current().loading).toBe(false));
  expect(current().error).toEqual(new ApiError(0, 'network_error'));
  expect(current().infra).toBeNull();
});
test.each([
  ['500', () => errorFor(500, internalError), { status: 500, code: 'internal_error' }],
  ['403', () => errorFor(403, invalidToken), { status: 403, code: 'invalid_token' }],
  ['network', async () => new ApiError(0, 'network_error'), { status: 0, code: 'network_error' }],
])('a %s failure exposes the ApiError and keeps the previous infra', async (_n, make, shape) => {
  await mount();
  await waitFor(() => expect(current().infra).toEqual(docker));
  const error = await make();
  getInfra.mockRejectedValueOnce(error);
  await act(async () => current().refetch());
  expect(current().error).toBe(error);
  expect(current().error).toMatchObject(shape);
  expect(current()).toMatchObject({ infra: docker, loading: false });
});
test('a 401 signs out through the client, without throwing or looping', async () => {
  const { client, onUnauthorized } = fixtureClient(401, invalidToken);
  const spy = jest.spyOn(client, 'getInfra');
  (session.apiClient as jest.Mock).mockReturnValue(client);
  await mount();
  await waitFor(() => expect(current().loading).toBe(false));
  expect(onUnauthorized).toHaveBeenCalledTimes(1);
  expect(current().error).toMatchObject({ status: 401, code: 'invalid_token' });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
  expect(spy).toHaveBeenCalledTimes(1);
  expect(onUnauthorized).toHaveBeenCalledTimes(1);
});
test('while focused, active alone loads once; background and inactive load nothing', async () => {
  await mount();
  await waitFor(() => expect(current().loading).toBe(false));
  getInfra.mockClear();
  await act(async () => {
    appState('background');
    appState('inactive');
  });
  expect(getInfra).not.toHaveBeenCalled();
  getInfra.mockResolvedValueOnce(kubernetes);
  await act(async () => appState('active'));
  expect(getInfra).toHaveBeenCalledTimes(1);
  expect(current()).toMatchObject({ infra: kubernetes, loading: false, error: null });
});
test.each([
  ['focus then active', () => [mockFocus(), appState('active')]],
  ['active then focus', () => [appState('active'), mockFocus()]],
])('%s together load once, and later foregrounds load again', async (_name, fire) => {
  await mount();
  await waitFor(() => expect(current().loading).toBe(false));
  getInfra.mockClear();
  const pending = deferred<Infra>();
  getInfra.mockReturnValueOnce(pending.promise);
  await act(async () => {
    fire();
  });
  expect(getInfra).toHaveBeenCalledTimes(1);
  await act(async () => pending.resolve(docker));
  expect(current()).toMatchObject({ infra: docker, loading: false });
  await act(async () => appState('active'));
  expect(getInfra).toHaveBeenCalledTimes(2);
});
test('after blur no foreground load, and the subscription is removed', async () => {
  await mount();
  await waitFor(() => expect(current().loading).toBe(false));
  getInfra.mockClear();
  await act(async () => mockBlur());
  expect(remove).toHaveBeenCalledTimes(1);
  await act(async () => appState('active'));
  expect(getInfra).not.toHaveBeenCalled();
});
test('after unmount no foreground load, and the subscription is removed', async () => {
  await mount();
  await waitFor(() => expect(current().loading).toBe(false));
  getInfra.mockClear();
  await view.unmount();
  expect(remove).toHaveBeenCalledTimes(1);
  appState('active');
  expect(getInfra).not.toHaveBeenCalled();
});
test('blur and refocus during an automatic load join it, and its response is shown', async () => {
  const first = deferred<Infra>();
  getInfra.mockReturnValueOnce(first.promise);
  await mount();
  await act(async () => {
    mockBlur();
    mockFocus();
  });
  expect(getInfra).toHaveBeenCalledTimes(1);
  await act(async () => first.resolve(kubernetes));
  expect(current()).toMatchObject({ infra: kubernetes, loading: false });
});
test('refetch during an automatic load starts a new request, and only the newest wins', async () => {
  const automatic = deferred<Infra>();
  const manual = deferred<Infra>();
  getInfra.mockReturnValueOnce(automatic.promise).mockReturnValueOnce(manual.promise);
  await mount();
  let refetched!: Promise<void>;
  await act(async () => {
    refetched = current().refetch();
  });
  expect(getInfra).toHaveBeenCalledTimes(2);
  await act(async () => manual.resolve(kubernetes));
  await act(async () => refetched);
  expect(current()).toMatchObject({ infra: kubernetes, loading: false });
  await act(async () => automatic.resolve(docker));
  expect(current()).toMatchObject({ infra: kubernetes, loading: false, error: null });
});
test('a stale failure after a newer request does not update state', async () => {
  await mount();
  await waitFor(() => expect(current().loading).toBe(false));
  const older = deferred<Infra>();
  getInfra.mockReturnValueOnce(older.promise).mockResolvedValueOnce(kubernetes);
  await act(async () => {
    void current().refetch();
    await current().refetch();
  });
  await act(async () => older.reject(await errorFor(500, internalError)));
  expect(current()).toMatchObject({ infra: kubernetes, loading: false, error: null });
});
test('a late response after unmount does not update state', async () => {
  const pending = deferred<Infra>();
  getInfra.mockReturnValueOnce(pending.promise);
  const errors = jest.spyOn(console, 'error');
  await mount();
  const before = current();
  await view.unmount();
  await act(async () => pending.resolve(kubernetes));
  expect(current()).toBe(before);
  expect(errors).not.toHaveBeenCalled();
});
