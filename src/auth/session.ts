import { useEffect, useSyncExternalStore } from 'react';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { redirectUri } from '../../app.identity';
import { createApiClient } from '../api/client';
import { discover, type AuthConfig } from './discovery';
import { AuthError } from './errors';
import { register } from './register';

WebBrowser.maybeCompleteAuthSession();
type Tokens = {
  host: string;
  clientId: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
};
type State = {
  status: 'signedOut' | 'signingIn' | 'signedIn';
  host: string | null;
  error: AuthError | null;
  ready: boolean;
};
const key = 'wardby.session';
class TokenRejectionError extends AuthError {}
export function createSession() {
  let tokens: Tokens | null = null;
  let config: AuthConfig | null = null;
  let state: State = { status: 'signedOut', host: null, error: null, ready: false };
  let refresh: Promise<string | null> | null = null;
  let initialization: Promise<void> | null = null;
  let generation = 0;
  const listeners = new Set<() => void>();
  const update = (next: Partial<State>) => {
    state = { ...state, ...next };
    listeners.forEach((listener) => listener());
  };
  async function clear() {
    generation++;
    tokens = null;
    config = null;
    update({ status: 'signedOut', host: null, ready: true });
    await SecureStore.deleteItemAsync(key);
  }
  async function initialize() {
    if (!initialization)
      initialization = (async () => {
        try {
          const saved = await SecureStore.getItemAsync(key);
          if (saved) {
            const parsed = JSON.parse(saved);
            if (
              typeof parsed.host !== 'string' ||
              typeof parsed.clientId !== 'string' ||
              typeof parsed.accessToken !== 'string' ||
              typeof parsed.refreshToken !== 'string' ||
              !Number.isFinite(parsed.expiresAt)
            )
              throw new Error();
            tokens = parsed;
            update({ status: 'signedIn', host: parsed.host });
          }
        } catch {
          await clear();
        }
        update({ ready: true });
      })();
    return initialization;
  }
  async function exchange(c: AuthConfig, params: Record<string, string>) {
    const response = await fetch(c.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString(),
    });
    const body = await response.json();
    if (
      !response.ok &&
      response.status < 500 &&
      (body.error === 'invalid_grant' || body.error === 'mobile_disabled')
    )
      throw new TokenRejectionError(
        body.error === 'mobile_disabled' ? 'mobile_disabled' : 'failed',
      );
    if (!response.ok)
      throw new AuthError(
        body.error === 'mobile_disabled' ||
          String(body.error_description).includes('mobile_disabled')
          ? 'mobile_disabled'
          : 'failed',
      );
    if (
      typeof body.access_token !== 'string' ||
      !body.access_token ||
      typeof body.expires_in !== 'number' ||
      body.expires_in <= 0
    )
      throw new AuthError('failed');
    return body as { access_token: string; refresh_token?: string; expires_in: number };
  }
  async function save(next: Tokens) {
    await SecureStore.setItemAsync(key, JSON.stringify(next));
    tokens = next;
    update({ status: 'signedIn', host: next.host, error: null, ready: true });
  }
  async function signIn(host: string) {
    await initialize();
    const current = ++generation;
    update({ status: 'signingIn', error: null });
    try {
      const c = await discover(host);
      const clientId = await register(c);
      const request = new AuthSession.AuthRequest({
        clientId,
        redirectUri: redirectUri(),
        responseType: AuthSession.ResponseType.Code,
        usePKCE: true,
        scopes: ['admin:view', ...(c.scopes.includes('offline_access') ? ['offline_access'] : [])],
        extraParams: { resource: c.resource },
      });
      const result = await request.promptAsync({
        authorizationEndpoint: c.authorizationEndpoint,
      });
      if (result.type === 'cancel' || result.type === 'dismiss') throw new AuthError('cancelled');
      if (result.type !== 'success' || !result.params.code || !request.codeVerifier)
        throw new AuthError('failed');
      const body = await exchange(c, {
        grant_type: 'authorization_code',
        client_id: clientId,
        code: result.params.code,
        code_verifier: request.codeVerifier,
        redirect_uri: redirectUri(),
        resource: c.resource,
      });
      if (!body.refresh_token) throw new AuthError('failed');
      if (current !== generation) return;
      config = c;
      await save({
        host: c.host,
        clientId,
        accessToken: body.access_token,
        refreshToken: body.refresh_token,
        expiresAt: Date.now() + body.expires_in * 1000,
      });
    } catch (error) {
      const authError = error instanceof AuthError ? error : new AuthError('failed');
      update({ status: tokens ? 'signedIn' : 'signedOut', error: authError });
      throw authError;
    }
  }
  async function getAccessToken(): Promise<string | null> {
    await initialize();
    if (!tokens) return null;
    if (tokens.expiresAt > Date.now() + 60000) return tokens.accessToken;
    if (!refresh) {
      const previous = tokens;
      const current = generation;
      refresh = (async () => {
        try {
          const c = config ?? (await discover(previous.host));
          const body = await exchange(c, {
            grant_type: 'refresh_token',
            client_id: previous.clientId,
            refresh_token: previous.refreshToken,
            resource: c.resource,
          });
          if (current !== generation) return null;
          config = c;
          await save({
            ...previous,
            accessToken: body.access_token,
            refreshToken: body.refresh_token ?? previous.refreshToken,
            expiresAt: Date.now() + body.expires_in * 1000,
          });
          return body.access_token;
        } catch (error) {
          if (current === generation && error instanceof TokenRejectionError) await clear();
          return null;
        } finally {
          refresh = null;
        }
      })();
    }
    return refresh;
  }
  async function signOut() {
    await initialize();
    const previous = tokens;
    const c = config;
    await clear();
    if (previous)
      try {
        const discovered = c ?? (await discover(previous.host));
        if (discovered.revocationEndpoint)
          await fetch(discovered.revocationEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              token: previous.refreshToken,
              token_type_hint: 'refresh_token',
              client_id: previous.clientId,
            }).toString(),
          });
      } catch {
        /* Revocation is best effort. */
      }
  }
  return {
    initialize,
    signIn,
    getAccessToken,
    signOut,
    clearError: () => update({ error: null }),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    getSnapshot: () => state,
    apiClient: () =>
      state.host
        ? createApiClient({
            baseUrl: state.host,
            getAccessToken,
            onUnauthorized: () => {
              void signOut();
            },
          })
        : null,
  };
}
export const session = createSession();
export function useSession() {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  useEffect(() => {
    void session.initialize();
  }, []);
  return {
    ...state,
    signIn: session.signIn,
    signOut: session.signOut,
    clearError: session.clearError,
  };
}
