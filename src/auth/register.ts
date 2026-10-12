import * as SecureStore from 'expo-secure-store';
import * as Crypto from 'expo-crypto';
import { redirectUri } from '../../app.identity';
import type { AuthConfig } from './discovery';
import { AuthError } from './errors';
export async function register(config: AuthConfig): Promise<string> {
  const key = `wardby.client.${await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, config.host)}`;
  const cached = await SecureStore.getItemAsync(key);
  if (cached) return cached;
  let response: Response;
  try {
    response = await fetch(config.registrationEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token_endpoint_auth_method: 'none',
        redirect_uris: [redirectUri()],
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        client_name: 'Wardby mobile',
      }),
    });
  } catch {
    throw new AuthError('unreachable');
  }
  let body;
  try {
    body = await response.json();
  } catch {
    throw new AuthError('failed');
  }
  if (!response.ok) {
    if (
      response.status === 400 &&
      body.error === 'invalid_redirect_uri' &&
      String(body.error_description).includes('mobile_disabled')
    )
      throw new AuthError('mobile_disabled');
    throw new AuthError('failed');
  }
  if (typeof body.client_id !== 'string' || !body.client_id) throw new AuthError('failed');
  await SecureStore.setItemAsync(key, body.client_id);
  return body.client_id;
}
