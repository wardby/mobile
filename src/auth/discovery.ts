import { AuthError } from './errors';
export { AuthError } from './errors';
export type AuthConfig = {
  host: string;
  resource: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  registrationEndpoint: string;
  revocationEndpoint?: string;
  scopes: string[];
};
export function normalizeHost(input: string): string {
  try {
    const value = input.trim();
    if (!value) throw new Error();
    const url = new URL(value.includes('://') ? value : `https://${value}`);
    const parts = url.hostname.split('.').map(Number);
    const ipv4 =
      parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
    const local =
      ['localhost', '127.0.0.1', '10.0.2.2'].includes(url.hostname) ||
      (ipv4 &&
        (parts[0] === 10 ||
          (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
          (parts[0] === 192 && parts[1] === 168)));
    if (
      url.username ||
      url.password ||
      !(url.protocol === 'https:' || (url.protocol === 'http:' && local))
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new AuthError('invalid_host');
  }
}
function endpoint(value: unknown): string {
  if (typeof value !== 'string') throw new AuthError('not_wardby');
  try {
    normalizeHost(value);
    return new URL(value).toString();
  } catch {
    throw new AuthError('not_wardby');
  }
}
async function metadata(url: string): Promise<Record<string, unknown>> {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    throw new AuthError('unreachable');
  }
  try {
    if (!response.ok) throw new Error();
    const body = await response.json();
    if (!body || typeof body !== 'object') throw new Error();
    return body;
  } catch {
    throw new AuthError('not_wardby');
  }
}
export async function discover(input: string): Promise<AuthConfig> {
  const host = normalizeHost(input);
  const resource = await metadata(`${host}/.well-known/oauth-protected-resource`);
  if (!Array.isArray(resource.authorization_servers) || !resource.authorization_servers.length)
    throw new AuthError('not_wardby');
  const issuer = endpoint(resource.authorization_servers[0]);
  const auth = await metadata(
    `${issuer.replace(/\/$/, '')}/.well-known/oauth-authorization-server`,
  );
  const config = {
    host,
    resource: endpoint(resource.resource),
    authorizationEndpoint: endpoint(auth.authorization_endpoint),
    tokenEndpoint: endpoint(auth.token_endpoint),
    registrationEndpoint: endpoint(auth.registration_endpoint),
    revocationEndpoint:
      auth.revocation_endpoint === undefined ? undefined : endpoint(auth.revocation_endpoint),
    scopes: auth.scopes_supported as string[],
  };
  if (!Array.isArray(config.scopes) || !config.scopes.every((scope) => typeof scope === 'string'))
    throw new AuthError('not_wardby');
  if (!config.scopes.includes('admin:view')) throw new AuthError('admin_view_unsupported');
  return config;
}
