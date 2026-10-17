# Plan: Infrastructure screen (issue #65)

## Summary

Add a read-only **Infrastructure** screen that shows where and how the signed-in admin's wardby server runs its work, like the desktop Viewer's Infrastructure tab. It shows two sections:

- **Coding launcher:** the `launcher` value (`local`, `docker` or `kubernetes`) and, when `kubernetes` is an object, its details.
- **Native agents:** `native.launcher`, `native.warmPoolSize` and, when `native.kubernetes` is an object, its details. When `native` is `null`, the section shows a clear "not configured" state.

Data comes from the existing typed client call `getInfra()` in `src/api/client.ts` (`GET /admin/api/infra`, `operationId: getInfra`, schema `infra-info` in `src/api/openapi.yml`). No new endpoint, field or network code is needed. The screen is a new stack route `app/infra.tsx` that opens from a `NavigationRow` in Settings, **not** a fourth tab (reason below).

**Navigation decision: an entry in Settings, not a fourth tab.**

- `app/(tabs)/_layout.tsx` (since #23) gives every tab label `fontSize: 14` with `allowFontScaling`, `tabBarLabelPosition: 'below-icon'` and `minWidth: 44`. `__tests__/navigation.test.tsx` checks the bar at `fontScale: 2`. With four tabs on a 320 pt wide phone (iPhone SE 1st gen; 360 dp is common on small Android phones), each tab gets about 80 pt. At `fontScale: 2` the label is 28 pt, so "Infrastructure" needs well over 150 pt. It would be cut off or wrap. A short label such as "Infra" is borderline at 28 pt, and the word is less clear. The plan doesn't take that trade-off.
- Infrastructure is deploy-time configuration. Admins check it now and then. They don't watch it like Runs or Spend, so it fits with the other server facts on Settings (the `SERVER` section already shows the host).
- A Settings entry leaves the tab bar, its icon mapping and its #23 tests unchanged.

**What the plan assumes about the server.** Only what the vendored contract (`src/api/openapi.yml`) already says:

- `GET /admin/api/infra` returns `infra-info` with the required keys `launcher`, `kubernetes` and `native`. `additionalProperties: false`, and clients must ignore unknown fields.
- `launcher` is one of `local | docker | kubernetes` and is never `null`. The schema has no "none" value (see Open questions).
- `kubernetes` is `null` or `{ namespace, platform, runtimeClass (string|null), proxyService, runLabel, runLabelHashChars, componentLabel (string map), managedByLabel (string map) }`.
- `native` is `null` or `{ launcher: docker|kubernetes, warmPoolSize: integer, kubernetes: null | { namespace, runtimeClass (string|null), runLabel, componentLabel (string map), warmPoolLabel (string map), warmWorkerLabel } }`.
- Errors: `401` and `403` both return `{ "error": "invalid_token" }`, `405` returns `method_not_allowed`, and `default` (500) returns `{ "error": "internal_error", "id": "…" }`.
- The live event stream (`/admin/api/events`) only sends `hello`, `run`, `service`, `outcome`, `status` and `resync` frames. None of them carries infrastructure data.

**Freshness decision.** The screen reloads on focus, when the app returns to the foreground (`AppState` → `active`) and on pull-to-refresh. **No `run`, `service` or `outcome` event triggers a reload.** They describe runs, not deployment configuration, and reloading on every run event would hit the server for nothing. Only the existing `resyncVersion` from `useLiveGraph()` triggers a reload (ticket 7). A `resync` happens when the server's live connection comes back, which includes a server restart, and a restart is when the infrastructure configuration can change. This uses the shared stream from `LiveGraphProvider` and adds no polling, so the AGENTS.md "Live data" rules hold.

**How 401/403 are handled, the same way as the other screens.** The hook gets its client from `session.apiClient()` (the same as `useRunDetail`). On `401`, that client calls `onUnauthorized` → `session.signOut()`, and the root `Stack.Protected` guard sends the user back to `connect`. A `403` (or any other error) shows the screen's error state with **Retry**, which is how `app/(tabs)/spend.tsx` and `app/runs/[id].tsx` handle it today.

## Why a plan

This is an epic. It needs new fixtures, a pure formatting module, a data hook, a new route, a Settings entry and a freshness rule. As one change it would be too big to review, and it mixes contract, data and UI decisions. Splitting it lets each PR be checked against one fixture set and one AGENTS.md definition of done, and lets a reviewer reject one piece (for example the resync reload) without blocking the rest. The navigation choice and the server assumptions above are made once, here, so builders don't make them again in different ways.

AGENTS.md check, so nothing below breaks a rule:

- No network code outside `src/api/`. The hook only calls `session.apiClient().getInfra()` and never calls `fetch`.
- No hardcoded host: the base URL comes from the session.
- No analytics or phone-home code.
- No edits to `.github/`, `ios/` or `android/`.
- No changes to the generated `src/api/openapi.yml` or `src/api/schema.ts`.
- No new dependencies. `@expo/vector-icons`, `expo-router`, `react-native` `AppState`/`RefreshControl` and the gluestack components in `components/ui/` are already there.

## Tickets

Every ticket keeps AGENTS.md's definition of done:

- `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm test` pass.
- `npm run export -- --platform web` runs once, last.
- Every new hook and screen has tests.
- Network code is tested only against recorded fixtures.
- The PR body says `Resolves #<issue>`, copies the ticket's checklist with each item ticked, and has a "How to try it" section.

No ticket changes `package.json`, `app.config.ts` or `app.identity.ts`, so none of them needs the full `npm run export`.

**New fixtures (all under `src/api/__fixtures__/`, all added in ticket 1):**

| File | Content | Used by |
| --- | --- | --- |
| `infra-kubernetes.json` | `launcher: "kubernetes"` with a full `kubernetes` object (`runtimeClass` set). `native.launcher: "kubernetes"` with a full `native.kubernetes` object (`runtimeClass: null`) and `warmPoolSize: 3`. | tickets 1–5 |
| `infra-unconfigured.json` | `launcher: "local"`, `kubernetes: null`, `native: null`. This is the closest the schema gets to "nothing configured". | tickets 1–5 |
| `internal_error.json` | `{ "error": "internal_error", "id": "…" }` (`ViewerInternalError`), the server-error response. | tickets 1, 3, 4 |

Reused fixtures: `infra.json` (Docker coding launcher, Docker native warm pool of 2, no Kubernetes) and `invalid_token.json`. The contract gives `401` and `403` the same `invalid_token` body, so no separate 403 fixture is needed. The tests only change the HTTP status.

### Ticket 1: Infrastructure fixtures and getInfra error coverage

**Scope.** Add `src/api/__fixtures__/infra-kubernetes.json`, `src/api/__fixtures__/infra-unconfigured.json` and `src/api/__fixtures__/internal_error.json`. Extend `src/api/__tests__/fixtures.test.ts`, following its existing pattern: write a typed example with `satisfies components['schemas'][...]`, compare it with `toEqual`, and add a `JsonShape` assertion for each new file. Extend `src/api/__tests__/client.test.ts` so `getInfra` (not only `getGraph`) is checked against error responses. Don't change `src/api/client.ts`, `openapi.yml` or `schema.ts`. Fixture values use placeholders only, with no real cluster names, hosts or tokens.

**Acceptance criteria**

- [ ] The three new fixture files exist, and each one matches `infra-info` or `ViewerInternalError` exactly (no invented fields).
- [ ] `infra-kubernetes.json` uses every field of both Kubernetes objects, includes at least one non-null and one null `runtimeClass`, and has non-empty label maps.
- [ ] `fixtures.test.ts` has a typed-example test and a `JsonShape` check for each new fixture.
- [ ] `client.test.ts` checks that `getInfra()` returns each infra fixture unchanged.
- [ ] `client.test.ts` checks that `getInfra()` maps `401` and `403` (`invalid_token.json`) and `500` (`internal_error.json`) to `ApiError`s with the right `status`, `code` and `requestId`. `onUnauthorized` fires only for `401`.
- [ ] No source file outside `src/api/__fixtures__/` and `src/api/__tests__/` changes.
- [ ] AGENTS.md definition of done.

**Tests.** `src/api/__tests__/fixtures.test.ts` and `src/api/__tests__/client.test.ts`, against `infra.json`, `infra-kubernetes.json`, `infra-unconfigured.json`, `invalid_token.json` and `internal_error.json`.

**Depends on.** Nothing.

### Ticket 2: Pure infra formatting helpers

**Scope.** New `src/infra/format.ts` with pure, React-free functions that turn `components['schemas']['infra-info']` into display data:

- `launcherLabel(launcher)`: `local` → "Local (on the server host)", `docker` → "Docker", `kubernetes` → "Kubernetes".
- `codingKubernetesRows(k8s)`: label/value rows for namespace, platform, runtime class (`null` → "Default"), proxy service, run label, run label hash length, component labels and managed-by labels.
- `nativeKubernetesRows(k8s)`: namespace, runtime class, run label, component labels, warm pool labels and warm worker label.
- `formatLabels(map)`: a sorted `key=value` list. An empty map gives "None".
- `warmPoolLabel(size)`: for example "2 workers", "1 worker", or "None" for `0`.

It reads only fields in the schema. The types come from `src/api/schema.ts`.

**Acceptance criteria**

- [ ] Every field of both Kubernetes objects in `infra-info` appears in exactly one row, and no other field is read.
- [ ] A `null` `runtimeClass` and an empty label map show a readable value, never "null" or a blank.
- [ ] The functions are pure: no React, no network, no `Date`.
- [ ] AGENTS.md definition of done.

**Tests.** New `__tests__/infra/format.test.ts`, against `infra.json`, `infra-kubernetes.json` and `infra-unconfigured.json` (from ticket 1). It covers each launcher value, both Kubernetes row builders, a null runtime class, empty and multi-key label maps, and warm pool sizes 0, 1 and 2.

**Depends on.** Ticket 1.

### Ticket 3: `useInfra` data hook

**Scope.** New `src/infra/useInfra.ts`, modelled on `src/runs/useRunDetail.ts` and `src/spend/useSpend.ts`:

- It returns `{ infra, loading, error, refetch }`.
- `refetch` gets the client from `session.apiClient()` and calls `getInfra()`. A missing client becomes `ApiError(0, 'network_error')`.
- It uses a request counter (the `request` ref pattern) so stale responses and responses after unmount are dropped.
- It loads when the screen gains focus (`useFocusEffect` from `expo-router`) and when `AppState` changes to `active`. The listener is removed on unmount.
- It keeps the last good `infra` while it refetches, so pull-to-refresh doesn't blank the screen.
- `401` handling stays in the client: `session.apiClient()`'s `onUnauthorized` signs out. The hook only exposes the `ApiError`.

There is no polling, no `fetch` and no new event-stream code.

**Acceptance criteria**

- [ ] On mount or focus the hook loads once, with `loading` true and then false.
- [ ] On success `infra` matches the fixture and `error` is `null`.
- [ ] On a `500`, `403` or network failure, `error` is the `ApiError` and the previous `infra` is kept.
- [ ] On a `401`, the client's `onUnauthorized` is called (sign-out), and the hook neither throws nor loops.
- [ ] An `AppState` change to `active` triggers exactly one refetch. `background` doesn't trigger one.
- [ ] A late response after unmount or a newer request doesn't update state.
- [ ] AGENTS.md definition of done.

**Tests.** New `__tests__/infra/useInfra.test.tsx`. It mocks `../../src/auth/session` (`session.apiClient`) and `expo-router` (`useFocusEffect`) as `__tests__/runs/detail.test.tsx` and `__tests__/spend/screen.test.tsx` do. It runs against `infra.json` and `infra-kubernetes.json`, plus `invalid_token.json` (401 and 403) and `internal_error.json` (500) wrapped in `ApiError` exactly as `createApiClient` would produce them.

**Depends on.** Ticket 1.

### Ticket 4: Infrastructure route with states and the Coding launcher section

**Scope.**

- New route `app/infra.tsx`, a default export `Infrastructure`.
- Register it in `app/_layout.tsx` inside the `auth.status === 'signedIn'` `Stack.Protected`, as `<Stack.Screen name="infra" options={{ headerShown: true, title: 'Infrastructure' }} />`, next to `runs/[id]`.
- The screen uses `useInfra()` (ticket 3) and the helpers from ticket 2. It follows the layout of `app/runs/[id].tsx` and `app/(tabs)/spend.tsx`: `SafeAreaView` and a `ScrollView` with `contentContainerClassName="p-6 gap-8"`. The `RefreshControl` has `testID="infra-refresh"` and `accessibilityLabel="Refresh infrastructure"`.
- Colours come only from `useColors()`. Section headers use the 13 px muted header style with `accessibilityRole="header"`.
- States:
  - Loading with no data: `Spinner` with "Loading infrastructure…" (`testID="infra-loading"`).
  - Error: "Couldn't load infrastructure." and a `TextButton` labelled "Retry" (`testID="infra-retry"`) in `testID="infra-error"`.
  - The **Coding launcher** section (`testID="infra-coding"`): the launcher value (`testID="infra-coding-launcher"`). When `kubernetes` is an object, its rows from `codingKubernetesRows` (`testID="infra-coding-kubernetes"`). When the launcher is `kubernetes` but `kubernetes` is `null`, "Kubernetes details not reported" (`testID="infra-coding-kubernetes-missing"`).
- The header back control follows `app/runs/[id].tsx`: a `TextButton` labelled "‹ Settings" (`testID="infra-header-back"`, `accessibilityLabel="Back to Settings"`). It calls `router.back()` when possible, or otherwise `router.replace('/settings')`.
- Every control has an accessible label and a `testID`. No `style` function on a control that also has a `className`.
- The route is not yet linked from the app UI. Ticket 6 adds the entry, and until then it can be reached only by its URL.

**Wireframes.** The layout this ticket builds, one frame per state. The Settings row (frame A) is added in ticket 6 and is shown only as the entry point. The Native agents section in frames D and E is added in ticket 5 and is shown so the whole screen is visible. Values in angle brackets come from the fixture under test. Nothing here adds a field outside `infra-info`.

```text
A. Entry point: Settings tab (row added in ticket 6)
+--------------------------------------+
| Settings                             |
|                                      |
| SERVER                               |
| <host>                  settings-host|
| +----------------------------------+ |
| | Infrastructure                 › | |  settings-infrastructure
| +----------------------------------+ |  "View infrastructure"
|                                      |
| APPEARANCE                           |
| [ System ] [ Light ] [ Dark ]        |
| ...                                  |
+--------------------------------------+
| Runs       |  Spend     | Settings * |  (still 3 tabs)
+--------------------------------------+
          | press -> router.push('/infra')
          v

B. Loading (no data yet)               testID="infra-loading"
+--------------------------------------+
| ‹ Settings      Infrastructure       |  infra-header-back
+--------------------------------------+
|                                      |
|                 ( o )                |  Spinner
|        Loading infrastructure…       |
|                                      |
+--------------------------------------+

C. Error (500, 403 or network)         testID="infra-error"
+--------------------------------------+
| ‹ Settings      Infrastructure       |
+--------------------------------------+
|                                      |
|     Couldn't load infrastructure.    |
|                                      |
|               [ Retry ]              |  infra-retry -> refetch()
|                                      |
+--------------------------------------+
  (401 never shows this frame: the client signs out
   and the guard returns the user to connect.)

D. Loaded, Kubernetes                  fixture: infra-kubernetes.json
+--------------------------------------+
| ‹ Settings      Infrastructure       |
+--------------------------------------+
|   (pull down to refresh)             |  infra-refresh
| CODING LAUNCHER                      |  infra-coding (header)
| Launcher           Kubernetes        |  infra-coding-launcher
| +- infra-coding-kubernetes --------+ |
| | Namespace        <namespace>     | |
| | Platform         <platform>      | |
| | Runtime class    <runtimeClass>  | |
| | Proxy service    <proxyService>  | |
| | Run label        <runLabel>      | |
| | Run label hash   <n> characters  | |
| | Component labels <key>=<value>   | |
| | Managed-by       <key>=<value>   | |
| +----------------------------------+ |
|                                      |
| NATIVE AGENTS          (ticket 5)    |  infra-native (header)
| Launcher           Kubernetes        |  infra-native-launcher
| Warm pool          3 workers         |  infra-native-warm-pool
| +- infra-native-kubernetes --------+ |
| | Namespace        <namespace>     | |
| | Runtime class    Default         | |  (null runtimeClass)
| | Run label        <runLabel>      | |
| | Component labels <key>=<value>   | |
| | Warm pool labels <key>=<value>   | |
| | Warm worker      <label>         | |
| +----------------------------------+ |
+--------------------------------------+

E. Not configured                      fixture: infra-unconfigured.json
+--------------------------------------+
| ‹ Settings      Infrastructure       |
+--------------------------------------+
| CODING LAUNCHER                      |
| Launcher   Local (on the server host)|  infra-coding-launcher
|                                      |  (no Kubernetes block; the
|                                      |   schema has no "none" value)
| NATIVE AGENTS          (ticket 5)    |
| Native agents aren't configured on   |  infra-native-not-configured
| this server.                         |  (muted text)
+--------------------------------------+
```

Long values wrap onto the next line and are never cut off. With `infra.json` (Docker) the screen looks like frame D with "Docker", "2 workers" and no Kubernetes blocks. When `launcher` is `kubernetes` but `kubernetes` is `null`, the Kubernetes block in frame D is replaced by "Kubernetes details not reported" (`infra-coding-kubernetes-missing`).

**Acceptance criteria**

- [ ] The loading, error-with-retry and content states each render with the testIDs above, and Retry calls `refetch`.
- [ ] Pull-to-refresh calls `refetch`, and `refreshing` follows `loading`.
- [ ] `infra.json` shows "Docker" and no Kubernetes block. `infra-kubernetes.json` shows "Kubernetes" and every coding Kubernetes row. `infra-unconfigured.json` shows "Local (on the server host)".
- [ ] A `403` shows the error state, not a sign-out. A `401` leaves sign-out to the client (as on other screens).
- [ ] The screen matches wireframes B, C, D (coding section) and E (coding section): same order, labels and testIDs.
- [ ] Light and dark mode both render with theme colours (as `__tests__/spend/screen.test.tsx` checks).
- [ ] `app/_layout.tsx` registers the route only inside the signed-in guard.
- [ ] AGENTS.md definition of done.

**Tests.** New `__tests__/infra/screen.test.tsx`. It mocks `useInfra` or `session.apiClient` and runs against `infra.json`, `infra-kubernetes.json`, `infra-unconfigured.json`, `invalid_token.json` (status 403) and `internal_error.json`. Extend `__tests__/navigation.test.tsx` only if needed to show that the route sits behind the signed-in guard.

**Depends on.** Tickets 2 and 3.

### Ticket 5: Native agents section

**Scope.** In `app/infra.tsx`, add the **Native agents** section (`testID="infra-native"`) below Coding launcher:

- When `native` is an object, it shows the execution launcher (`testID="infra-native-launcher"`, using `launcherLabel`) and the warm pool size (`testID="infra-native-warm-pool"`, using `warmPoolLabel`). When `native.kubernetes` is an object, it also shows the `nativeKubernetesRows` (`testID="infra-native-kubernetes"`).
- When `native` is `null`, it shows a muted "Native agents aren't configured on this server." (`testID="infra-native-not-configured"`).

If a row-builder change is needed, it goes into `src/infra/format.ts` with tests.

**Acceptance criteria**

- [ ] `infra.json` shows "Docker" and "2 workers" with no Kubernetes block.
- [ ] `infra-kubernetes.json` shows "Kubernetes", "3 workers" and every native Kubernetes row, with the null runtime class shown as "Default".
- [ ] `infra-unconfigured.json` shows the not-configured state and no launcher or warm-pool rows.
- [ ] The Coding launcher section from ticket 4 is unchanged.
- [ ] AGENTS.md definition of done.

**Tests.** Extend `__tests__/infra/screen.test.tsx` against `infra.json`, `infra-kubernetes.json` and `infra-unconfigured.json`.

**Depends on.** Ticket 4.

### Ticket 6: Settings entry to the Infrastructure screen

**Scope.** In `app/(tabs)/settings.tsx`, add a `NavigationRow` (from `src/ui/interactions.tsx`) under the existing `SERVER` section, so it sits beside the host:

- It is labelled "Infrastructure", with `accessibilityLabel="View infrastructure"` and `testID="settings-infrastructure"`.
- It calls `router.push('/infra')`.
- It keeps the trailing `›`, which only in-app navigation uses.
- Existing Settings labels and testIDs (`settings-host`, `settings-appearance-*`, `settings-version`, `settings-sign-out`) stay unchanged.

No change to `app/(tabs)/_layout.tsx`, which keeps three tabs.

**Acceptance criteria**

- [ ] Settings shows the Infrastructure row with an accessible label, a `testID` and a target of at least 44×44.
- [ ] Pressing it opens the Infrastructure screen, and the header back control returns to Settings.
- [ ] The tab bar still has exactly the Runs, Spend and Settings tabs, and the #23 tab-bar tests pass unchanged.
- [ ] AGENTS.md definition of done.

**Tests.** Extend `__tests__/navigation.test.tsx` (signed in, with `getInfra` resolving `infra.json` through a mocked client) to press `settings-infrastructure`, check that the infra screen renders, and go back. Extend a Settings test (`__tests__/settings/`) to check the row's label and testID.

**Depends on.** Ticket 5.

### Ticket 7: Reload infrastructure on live-stream resync

**Scope.** In `src/infra/useInfra.ts`, read `resyncVersion` from `useLiveGraph()` (`src/live/useLiveGraph.ts`). When it changes after mount, refetch once, using the same compare-with-previous pattern as `useRunDetail`. Don't react to `run`, `service` or `outcome` events, and don't add event-stream code. The reason is in Summary → Freshness decision. This is a separate ticket so a reviewer can accept or reject it on its own.

**Acceptance criteria**

- [ ] A `resyncVersion` change triggers exactly one `getInfra()` call. The first render triggers no extra call.
- [ ] Graph changes from `run`, `service` or `outcome` events trigger no `getInfra()` call.
- [ ] No new network or event-stream code outside `src/api/` and `src/live/`.
- [ ] AGENTS.md definition of done.

**Tests.** Extend `__tests__/infra/useInfra.test.tsx`. It mocks `useLiveGraph` as `__tests__/runs/detail.test.tsx` does, against `infra.json` and `infra-kubernetes.json` (the second response after a resync, to show the screen data changes).

**Depends on.** Ticket 3. Land it after ticket 6 so the user-visible flow ships first.

## Risks

- **"None" vs. `local`.** The issue asks for "Docker, Kubernetes, or none", but the contract's `launcher` is a required, non-null enum of `local | docker | kubernetes`. The plan shows `local` as "Local (on the server host)" and gives the coding section no "not configured" state, because the server can't express one. If wardby/wardby adds one, a follow-up ticket is needed (see Open questions).
- **Inconsistent payloads.** The schema doesn't tie `kubernetes` to `launcher === 'kubernetes'`. Ticket 4 shows Kubernetes details whenever the object is present and handles `launcher: kubernetes` with `kubernetes: null` explicitly, so neither case crashes or shows a blank.
- **Contract drift.** If a later `@wardby/cli` bump changes `infra-info`, the fixture tests from ticket 1 and the typed helpers from ticket 2 will fail at typecheck or test time. That is the intended early warning. Builders must not hand-edit `openapi.yml` or `schema.ts`.
- **Long values on small screens.** Namespaces, label maps and proxy service names can be long. Rows should wrap (no `numberOfLines` truncation) and be checked at `fontScale: 2`, like the #23 tab-bar test.
- **Sensitive-looking details.** Namespaces and labels are deployment details, shown only to signed-in admins whose token has `admin:view`. Nothing is cached to disk or sent anywhere else. Test fixtures use placeholder values only.
- **403 wording.** Following "the same way as the other screens" means a `403` shows a generic "Couldn't load" error with Retry, and Retry won't help a user without the admin role. This keeps the app consistent. A better message for all screens is listed as an open question rather than done only here.
- **Extra requests.** Reloading on focus, on foreground and on resync is a few small GETs. No polling is added, so the AGENTS.md live-data rule holds.

## Open questions

- **Server change for wardby/wardby:** should `infra-info.launcher` allow a "no coding launcher configured" value (for example `null` or `"none"`)? Today the screen can't tell "not configured" apart from `local`.
- **Server change for wardby/wardby:** the desktop Viewer's Infrastructure tab may show more than `infra-info` serves (for example live warm-pool occupancy, or cluster or node health). If admins want that on the phone, the server would need to serve it first. This plan uses only today's fields.
- **Server change for wardby/wardby (optional):** an `infra` (or `config`) event on `/admin/api/events` would let the app reload exactly when the configuration changes. Without it, ticket 7 relies on `resync`, on the assumption that infrastructure changes only when the server restarts.
- Should a `403` (missing admin role or `admin:view` scope) get its own message on every screen instead of the generic error? If so, that is a separate cross-screen issue covering Runs, Spend, Run detail and Infrastructure.
- Should the label maps (`componentLabel`, `managedByLabel`, `warmPoolLabel`) be collapsed behind a `TextButton` disclosure (`expanded`) by default to keep the screen short? The plan shows them expanded. A follow-up can add the disclosure.
- Is "Local (on the server host)" the right wording for `launcher: local`? Please confirm it matches the desktop Viewer.
