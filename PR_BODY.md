Adds Connect and OAuth PKCE sign-in against the user's own wardby server, secure session persistence, token refresh, and a signed-in placeholder. API authorization now uses the session and signs out on unauthorized responses.

## Acceptance checklist

- [x] Only `expo-auth-session`, `expo-crypto`, `expo-secure-store` and `expo-web-browser` added through a single `npx expo install` command. Expo requested manual config-plugin additions after installation; those are included.
- [x] Discovery, registration and session implemented with typed errors and mobile-disabled operator guidance.
- [x] Tokens persist only in SecureStore; no token logging or AsyncStorage.
- [x] Near-expiry refresh shares one in-flight request; failed refresh signs out.
- [x] Connect and signed-in placeholder implement the specified copy, controls, keyboard handling and light/dark colors.
- [x] Scope 6 cases covered with mocked fetch and Expo modules; no live server.
- [x] No fixed server host; redirect comes from the identity config.
- [x] AGENTS.md Auth section and network rule updated.
- [ ] All local checks and external CI: see validation below. External `ci` is run by the host, not available in this worker.
- [x] This checklist, How to try it, and issue resolution included.

## Tests and test-first evidence

New auth cases: host normalization and HTTP restrictions; valid discovery; missing endpoint fields; missing scope metadata; missing admin:view; unreachable discovery; public registration; mobile-disabled registration; per-host client caching; PKCE code exchange and secure token persistence; near-expiry refresh; concurrent refresh; invalid-grant/mobile-disabled refresh cleanup; revocation success, HTTP failure and network failure; API unauthorized cleanup; secure session restoration; optional offline_access; hook status, host and error updates; explicit operator setting guidance.

New screen cases: empty-host disabled submit; field configuration and helper; all seven exact error messages and edit clearing; submit success navigation; Return submission; signing-in state; signed-out redirect; signed-in host and sign-out.

The initial auth and Connect suites were run before their modules existed and failed on missing modules. Both placeholder screen behavior tests failed against the original screen. Missing scope metadata and explicit operator-setting regressions were run against the implementation and failed before correction. Individual auth and Connect behavior assertions were not each observed failing separately; the initial failures stopped those suites at module loading.

## Validation

`npm run typecheck`, `npm run lint`, `npm run format:check`, `npm test -- --runInBand` (54 tests), and `npm run export` pass. Lint retains only the existing identity-config warnings. SDK 57 documentation could not be fetched under the worker's network restrictions; installed SDK 57 declarations were inspected. External CI and device/browser sign-in are not available here.

## How to try it

Start the app with `npm start`. Enable `WARDBY_MOBILE_ENABLED=true` on your wardby server, enter its HTTPS address on Connect, and choose Sign in. Approve admin viewing in the browser. The placeholder displays your server host; Sign out clears the stored session and attempts revocation. HTTP is accepted only for the documented local-development addresses and private LAN IPv4 ranges.

Resolves #9
