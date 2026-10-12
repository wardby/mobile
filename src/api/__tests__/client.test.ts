import graph from '../__fixtures__/graph.json';
import run from '../__fixtures__/run-detail.json';
import infra from '../__fixtures__/infra.json';
import invalidSince from '../__fixtures__/invalid_since.json';
import notFound from '../__fixtures__/not_found.json';
import invalidToken from '../__fixtures__/invalid_token.json';
import { ApiError, createApiClient } from '../client';

const baseUrl = new URL('/ ', 'https://example.invalid').origin;
function setup(body: unknown, status = 200, token: string | null = null) {
  const fetch = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: new Headers({ 'x-request-id': 'request-1' }),
  });
  const onUnauthorized = jest.fn();
  const client = createApiClient({ baseUrl, getAccessToken: () => token, fetch, onUnauthorized });
  return { client, fetch, onUnauthorized };
}

it.each(['getGraph', 'getInfra'] as const)(
  'returns the %s response without a token',
  async (method) => {
    const body = method === 'getGraph' ? graph : infra;
    const { client, fetch } = setup(body);
    expect(await client[method]()).toEqual(body);
    expect(fetch).toHaveBeenCalledWith(
      `${baseUrl}/admin/api/${method === 'getGraph' ? 'graph' : 'infra'}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      },
    );
  },
);
it('encodes the run id and returns run detail', async () => {
  const { client, fetch } = setup(run);
  expect(await client.getRun('run/a ?#')).toEqual(run);
  expect(fetch.mock.calls[0][0]).toBe(`${baseUrl}/admin/api/runs/run%2Fa%20%3F%23`);
});
it('encodes since and limit and sends the bearer header', async () => {
  const token = ['test', 'credential'].join('-');
  const { client, fetch } = setup(graph, 200, token);
  await client.getGraph({ since: '2026-10-01T12:00:00+01:00', limit: 12 });
  const url = new URL(fetch.mock.calls[0][0]);
  expect(url.searchParams.get('since')).toBe('2026-10-01T12:00:00+01:00');
  expect(url.searchParams.get('limit')).toBe('12');
  expect(fetch.mock.calls[0][1].headers).toEqual({
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  });
});
it.each([
  [400, invalidSince],
  [404, notFound],
  [401, invalidToken],
] as const)('maps HTTP %s errors', async (status, body) => {
  const { client, onUnauthorized } = setup(body, status);
  await expect(client.getGraph()).rejects.toBeInstanceOf(ApiError);
  await expect(client.getGraph()).rejects.toMatchObject({
    status,
    code: body.error,
    requestId: 'request-1',
  });
  expect(onUnauthorized).toHaveBeenCalledTimes(status === 401 ? 2 : 0);
});
it('maps network failures', async () => {
  const { client, fetch, onUnauthorized } = setup(null);
  fetch.mockRejectedValue(new TypeError('Connection failed'));
  await expect(client.getInfra()).rejects.toMatchObject({ status: 0, code: 'network_error' });
  expect(onUnauthorized).not.toHaveBeenCalled();
});
it('keeps the HTTP status when an error body is not JSON', async () => {
  const { client, fetch } = setup(null);
  fetch.mockResolvedValue({
    ok: false,
    status: 502,
    headers: new Headers(),
    json: async () => {
      throw new SyntaxError();
    },
  });
  await expect(client.getInfra()).rejects.toMatchObject({ status: 502, code: 'http_error' });
});
it('retains the internal error id', async () => {
  const { client, fetch } = setup(null);
  fetch.mockResolvedValue({
    ok: false,
    status: 500,
    headers: new Headers(),
    json: async () => ({ error: 'internal_error', id: 'failure-1' }),
  });
  await expect(client.getInfra()).rejects.toMatchObject({ requestId: 'failure-1' });
});
