import fixtures from '../fixtures/events.json';
import { openEventStream } from '../../src/live/stream';
import { baseUrl, fakeStream, flush } from './fakes';

function setup(response: Partial<{ ok: boolean; status: number }> = {}) {
  const stream = fakeStream();
  const fetch = jest
    .fn()
    .mockResolvedValue({ ok: true, status: 200, ...response, body: stream.body });
  const handlers = {
    onFrame: jest.fn(),
    onOpen: jest.fn(),
    onError: jest.fn(),
    onRetry: jest.fn(),
    onUnauthorized: jest.fn(),
  };
  const controller = new AbortController();
  const done = openEventStream({
    baseUrl,
    getAccessToken: async () => 'fake-token',
    fetch,
    signal: controller.signal,
    ...handlers,
  });
  return { stream, fetch, handlers, controller, done };
}

test('sends the bearer and Accept headers', async () => {
  const { fetch, controller, done } = setup();
  await flush();
  expect(fetch).toHaveBeenCalledWith(`${baseUrl}/admin/api/events`, {
    method: 'GET',
    headers: { Accept: 'text/event-stream', Authorization: 'Bearer fake-token' },
    signal: expect.any(AbortSignal),
  });
  controller.abort();
  await done;
});
test('frames reach onFrame after onOpen, and retry reaches onRetry', async () => {
  const { stream, handlers, controller, done } = setup();
  await flush();
  expect(handlers.onOpen).toHaveBeenCalledTimes(1);
  const half = fixtures.stream.length / 2;
  stream.push(fixtures.stream.slice(0, half));
  stream.push(fixtures.stream.slice(half));
  await flush();
  expect(handlers.onRetry).toHaveBeenCalledWith(3000);
  expect(handlers.onFrame.mock.calls.map(([frame]) => frame.event)).toEqual([
    'hello',
    'run',
    'service',
    'outcome',
    'status',
    'status',
    'resync',
  ]);
  controller.abort();
  await done;
  expect(stream.cancelled).toBe(true);
  expect(handlers.onError).not.toHaveBeenCalled();
});
test('a 401 calls onUnauthorized and not onError', async () => {
  const { handlers, done } = setup({ ok: false, status: 401 });
  await done;
  expect(handlers.onUnauthorized).toHaveBeenCalledTimes(1);
  expect(handlers.onOpen).not.toHaveBeenCalled();
  expect(handlers.onError).not.toHaveBeenCalled();
});
test('a missing token calls onError without sending the request', async () => {
  const fetch = jest.fn();
  const onError = jest.fn();
  const onUnauthorized = jest.fn();
  await openEventStream({
    baseUrl,
    getAccessToken: async () => null,
    fetch,
    signal: new AbortController().signal,
    onFrame: jest.fn(),
    onError,
    onUnauthorized,
  });
  expect(fetch).not.toHaveBeenCalled();
  expect(onError).toHaveBeenCalledTimes(1);
  expect(onUnauthorized).not.toHaveBeenCalled();
});
test('another HTTP failure calls onError', async () => {
  const { handlers, done } = setup({ ok: false, status: 500 });
  await done;
  expect(handlers.onError).toHaveBeenCalledTimes(1);
  expect(handlers.onOpen).not.toHaveBeenCalled();
  expect(handlers.onUnauthorized).not.toHaveBeenCalled();
});
test('a network error before opening calls onError', async () => {
  const fetch = jest.fn().mockRejectedValue(new TypeError('Network request failed'));
  const onError = jest.fn();
  await openEventStream({
    baseUrl,
    getAccessToken: () => 'fake-token',
    fetch,
    signal: new AbortController().signal,
    onFrame: jest.fn(),
    onError,
  });
  expect(onError).toHaveBeenCalledTimes(1);
});
test('a network error mid-stream calls onError', async () => {
  const { stream, handlers, done } = setup();
  await flush();
  stream.fail();
  await done;
  expect(handlers.onError).toHaveBeenCalledTimes(1);
});
test('the stream ending calls onError', async () => {
  const { stream, handlers, done } = setup();
  await flush();
  stream.push('event: hello\ndata: {"connected":true}\n\n');
  stream.end();
  await done;
  expect(handlers.onFrame).toHaveBeenCalledTimes(1);
  expect(handlers.onError).toHaveBeenCalledTimes(1);
});
