# Plan: Infrastructure screen (issue #65)

## Summary

Add a read-only **Infrastructure** screen that shows where and how the signed-in admin's wardby server runs its work, like the desktop Viewer's Infrastructure tab. It shows two sections:

- **Coding launcher:** the `launcher` value (`docker` or `kubernetes`) and, when `kubernetes` is an object, its details. `launcher: local` means the server has no container executor, so the section shows a clear "Not configured" state for it.
- **Native agents:** `native.launcher`, `native.warmPoolSize` and, when `native.kubernetes` is an object, its details. When `native` is `null`, the section shows a clear "not configured" state.

Data comes from the existing typed client call `getInfra()` in `src/api/client.ts` (`GET /admin/api/infra`, `operationId: getInfra`, schema `infra-info` in `src/api/openapi.yml`). No new endpoint, field or network code is needed. The screen is a new tab route `app/(tabs)/infra.tsx`, shown as a **fourth bottom tab labelled "Infra"**, between Spend and Settings. The tab order becomes Runs, Spend, Infra, Settings. The screen's header title stays "Infrastructure".

**Navigation decision: a fourth tab labelled "Infra", not a Settings row.**

- Infrastructure is a top-level view of the server, next to Runs and Spend, and the desktop Viewer gives it its own tab. A tab puts it one tap away from every screen and matches what admins already know from the Viewer. It sits before Settings so Settings stays last, where users expect it.
- Fit on small phones. `app/(tabs)/_layout.tsx` (since #23) gives every tab label `fontSize: 14` with `allowFontScaling`, `tabBarLabelPosition: 'below-icon'` and `minWidth: 44`, and grows the bar's height with `fontScale`. With four tabs on a 320 pt wide phone (iPhone SE 1st gen; 360 dp is common on small Android phones), each tab gets about 80 pt. "Infrastructure" would need well over 150 pt at `fontScale: 2` (28 pt text), so it can't be the tab label. The short label "Infra" is about 60 pt wide at 28 pt and fits. The label is set by `title: 'Infra'`, and the header keeps the full word through `headerTitle: 'Infrastructure'`. Screen readers also hear the full word: the tab's `accessibilityLabel` is "Infrastructure" (`tabBarAccessibilityLabel: 'Infrastructure'`), while its visible label stays "Infra" (owner decision).
- Ticket 6 adds the tab and a `fontScale: 2`, 320 pt wide test in `__tests__/navigation.test.tsx`. The remaining font-scaling risk, including the existing "Settings" label, is under Risks.
- The tab adds one `Tabs.Screen` and one icon (Ionicons `server` / `server-outline`) to `app/(tabs)/_layout.tsx`. The icon is already in `@expo/vector-icons`, so no new dependency is needed.

**What the plan assumes about the server.** Only what the vendored contract (`src/api/openapi.yml`) already says:

- `GET /admin/api/infra` returns `infra-info` with the required keys `launcher`, `kubernetes` and `native`. `additionalProperties: false`, and clients must ignore unknown fields.
- `launcher` is one of `local | docker | kubernetes` and is never `null`. In wardby, `JOB_LAUNCHER=local` means there is **no container executor**: coding runs end with "Coding agents need a container executor". So `local` does not mean "runs on the server host"; it is the server's "not configured" value, and the app shows it as such (owner decision). No separate "none" value is needed.
- `kubernetes` is `null` or `{ namespace, platform, runtimeClass (string|null), proxyService, runLabel, runLabelHashChars, componentLabel (string map), managedByLabel (string map) }`.
- `native` is `null` or `{ launcher: docker|kubernetes, warmPoolSize: integer, kubernetes: null | { namespace, runtimeClass (string|null), runLabel, componentLabel (string map), warmPoolLabel (string map), warmWorkerLabel } }`.
- Errors: `401` and `403` both return `{ "error": "invalid_token" }`, `405` returns `method_not_allowed`, and `default` (500) returns `{ "error": "internal_error", "id": "…" }`.
- The live event stream (`/admin/api/events`) only sends `hello`, `run`, `service`, `outcome`, `status` and `resync` frames. None of them carries infrastructure data.

**Freshness decision.** The screen reloads when its tab gains focus, when the app returns to the foreground (`AppState` → `active`) and on pull-to-refresh. A focus event and a foreground event that arrive together are coalesced into one request (ticket 3). **No `run`, `service` or `outcome` event triggers a reload.** They describe runs, not deployment configuration, and reloading on every run event would hit the server for nothing. Only the existing `resyncVersion` from `useLiveGraph()` triggers a reload (ticket 7). A `resync` happens when the server's live connection comes back, which includes a server restart, and a restart is when the infrastructure configuration can change. This uses the shared stream from `LiveGraphProvider` (in `app/_layout.tsx`) and adds no polling, so the AGENTS.md "Live data" rules hold.

**How 401/403 are handled, the same way as the other screens.** The hook gets its client from `session.apiClient()` (the same as `useRunDetail`). On `401`, that client calls `onUnauthorized` → `session.signOut()`, and the root `Stack.Protected` guard sends the user back to `connect`. A `403` (or any other error) shows the screen's error state with **Retry**, which is how `app/(tabs)/spend.tsx` and `app/runs/[id].tsx` handle it today.

## Why a plan

This is an epic. It needs new fixtures, a pure formatting module, a data hook, a new screen, a new tab and a freshness rule. As one change it would be too big to review, and it mixes contract, data and UI decisions. Splitting it lets each PR be checked against one fixture set and one AGENTS.md definition of done, and lets a reviewer reject one piece (for example the resync reload, or the tab itself) without blocking the rest. The navigation choice and the server assumptions above are made once, here, so builders don't make them again in different ways.

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

| File                      | Content                                                                                                                                                                                             | Used by         |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------- |
| `infra-kubernetes.json`   | `launcher: "kubernetes"` with a full `kubernetes` object (`runtimeClass` set). `native.launcher: "kubernetes"` with a full `native.kubernetes` object (`runtimeClass: null`) and `warmPoolSize: 3`. | tickets 1–5     |
| `infra-unconfigured.json` | `launcher: "local"`, `kubernetes: null`, `native: null`. `local` means no container executor, so this is the "nothing configured" payload.                                                          | tickets 1–5     |
| `internal_error.json`     | `{ "error": "internal_error", "id": "…" }` (`ViewerInternalError`), the server-error response.                                                                                                      | tickets 1, 3, 4 |

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

- `launcherLabel(launcher)`: `local` → "Not configured", `docker` → "Docker", `kubernetes` → "Kubernetes".
- `isCodingLauncherConfigured(launcher)`: `false` for `local` (no container executor), `true` for `docker` and `kubernetes`.
- `CODING_NOT_CONFIGURED_TEXT`: the exported string "Coding agents can't run on this server. It needs a Docker or Kubernetes launcher.", so the screen and its tests use the same wording.
- `codingKubernetesRows(k8s)`: label/value rows for namespace, platform, runtime class (`null` → "Default"), proxy service, run label, run label hash length, component labels and managed-by labels.
- `nativeKubernetesRows(k8s)`: namespace, runtime class, run label, component labels, warm pool labels and warm worker label.
- `formatLabels(map)`: a sorted `key=value` list. An empty map gives "None".
- `warmPoolLabel(size)`: for example "2 workers", "1 worker", or "None" for `0`.

It reads only fields in the schema. The types come from `src/api/schema.ts`.

**Acceptance criteria**

- [ ] Every field of both Kubernetes objects in `infra-info` appears in exactly one row, and no other field is read.
- [ ] A `null` `runtimeClass` and an empty label map show a readable value, never "null" or a blank.
- [ ] `launcherLabel('local')` is "Not configured" and `isCodingLauncherConfigured('local')` is `false`; nothing returns "Local" or mentions the server host.
- [ ] The functions are pure: no React, no network, no `Date`.
- [ ] AGENTS.md definition of done.

**Tests.** New `__tests__/infra/format.test.ts`, against `infra.json`, `infra-kubernetes.json` and `infra-unconfigured.json` (from ticket 1). It covers each launcher value (including `local` → "Not configured" and `isCodingLauncherConfigured` for all three values), both Kubernetes row builders, a null runtime class, empty and multi-key label maps, and warm pool sizes 0, 1 and 2.

**Depends on.** Ticket 1.

### Ticket 3: `useInfra` data hook

**Scope.** New `src/infra/useInfra.ts`, modelled on `src/runs/useRunDetail.ts` and `src/spend/useSpend.ts`:

- It returns `{ infra, loading, error, refetch }`.
- `refetch` gets the client from `session.apiClient()` and calls `getInfra()`. A missing client becomes `ApiError(0, 'network_error')`.
- It uses a request counter (the `request` ref pattern) so stale responses and responses after unmount are dropped.
- It loads automatically on two triggers:
  - **Focus:** `useFocusEffect` from `expo-router` (as in `useSpend`), which also fires when the user switches to the tab.
  - **Foreground:** an `AppState` `change` listener that loads when the state becomes `active`. The listener is added inside the `useFocusEffect` callback and removed in its cleanup, so it only runs while the screen is focused and is gone after blur or unmount. Returning to the foreground on another tab doesn't call `getInfra()`.
- **Focus and foreground are coalesced.** A focus event and an `AppState` `active` event that arrive together (in either order, in the same tick or while the load started by the first one is still in flight) cause **one** `getInfra()` call, not two. The hook keeps an "automatic load in flight" flag (a ref next to `request`): an automatic trigger that arrives while it is set joins the running load and doesn't start a new one. The flag clears when that load settles, so a later focus or foreground starts a fresh load. Explicit calls to `refetch` (Retry and pull-to-refresh in ticket 4) are not coalesced: they always start a new request, and the request counter drops the older response.
- It keeps the last good `infra` while it refetches, so pull-to-refresh doesn't blank the screen.
- `401` handling stays in the client: `session.apiClient()`'s `onUnauthorized` signs out. The hook only exposes the `ApiError`.

There is no polling, no `fetch` and no new event-stream code. The hook adds no screen, so this ticket has no wireframe.

**Acceptance criteria**

- [ ] On mount or focus the hook loads once, with `loading` true and then false.
- [ ] On success `infra` matches the fixture and `error` is `null`.
- [ ] On a `500`, `403` or network failure, `error` is the `ApiError` and the previous `infra` is kept.
- [ ] On a `401`, the client's `onUnauthorized` is called (sign-out), and the hook neither throws nor loops.
- [ ] While focused, an `AppState` change to `active` (with no focus event) triggers exactly one `getInfra()` call. `background` and `inactive` trigger none.
- [ ] A focus event and an `AppState` `active` event arriving together, in either order, cause exactly one `getInfra()` call, not two.
- [ ] After that coalesced load settles, a new `active` event triggers exactly one more call (coalescing is not permanent).
- [ ] After blur or unmount, an `AppState` change to `active` triggers no call, and the `AppState` subscription's `remove()` has been called.
- [ ] Calling `refetch()` while an automatic load is in flight starts a new request, and only the newest response updates `infra`.
- [ ] A late response after unmount or a newer request doesn't update state.
- [ ] AGENTS.md definition of done.

**Tests.** New `__tests__/infra/useInfra.test.tsx`, rendering the hook in a small test component:

- Mocks: `../../src/auth/session` (`session.apiClient` returns an object with a `getInfra` `jest.fn()`), and `expo-router`'s `useFocusEffect` captured into a `mockFocus` callback, as `__tests__/spend/screen.test.tsx` does. `AppState.addEventListener` from `react-native` is replaced with `jest.spyOn` so the test keeps the `change` handler and a `remove` mock.
- Fixtures: `infra.json` and `infra-kubernetes.json`, plus `invalid_token.json` (401 and 403) and `internal_error.json` (500), wrapped in `ApiError` exactly as `createApiClient` would produce them.
- **New coalescing test** (`test.each` over both orders, "focus then active" and "active then focus"): `getInfra` returns a deferred promise. Inside one `act()` the test fires `mockFocus()` and the captured `AppState` handler with `'active'`. It asserts `getInfra` was called **exactly once** (`toHaveBeenCalledTimes(1)`). It then resolves the promise with `infra.json` and asserts `infra` equals the fixture and `loading` is `false`. Finally it fires `'active'` again and asserts `getInfra` has been called twice in total.
- Further tests, one per acceptance item above: `active` alone triggers one call, `background`/`inactive` trigger none, no call after blur or unmount (and `remove` called), error mapping for 401/403/500 with the previous `infra` kept, `refetch()` during an in-flight automatic load, and stale-response dropping.

**Depends on.** Ticket 1.

### Ticket 4: Infrastructure screen with states and the Coding launcher section

**Scope.**

- New tab route `app/(tabs)/infra.tsx`, a default export `Infrastructure`. Because it lives in the `(tabs)` group, it is already inside the signed-in `Stack.Protected` in `app/_layout.tsx` and under the shared `LiveGraphProvider`. `app/_layout.tsx` doesn't change.
- In `app/(tabs)/_layout.tsx`, register it **hidden** between the `spend` and `settings` screens: `<Tabs.Screen name="infra" options={{ href: null, headerTitle: 'Infrastructure' }} />`. Without this, Expo Router would add every file in `(tabs)` as a visible tab with a fallback icon. Ticket 6 removes `href: null` and makes it a real tab. The builder checks `href: null` against the Expo Router docs for the `expo` major version in `package.json`, as AGENTS.md requires.
- The screen uses `useInfra()` (ticket 3) and the helpers from ticket 2. It follows the layout of `app/(tabs)/spend.tsx`: `SafeAreaView` (`edges={['left', 'right']}`) and a `ScrollView` with `contentContainerClassName="p-6 gap-8"`. The `RefreshControl` has `testID="infra-refresh"` and `accessibilityLabel="Refresh infrastructure"`.
- Colours come only from `useColors()`. Section headers use the 13 px muted header style that `app/(tabs)/settings.tsx` uses, with `accessibilityRole="header"`.
- States:
  - Loading with no data: `Spinner` with "Loading infrastructure…" (`testID="infra-loading"`).
  - Error: "Couldn't load infrastructure." and a `TextButton` labelled "Retry" (`testID="infra-retry"`) in `testID="infra-error"`.
  - The **Coding launcher** section (`testID="infra-coding"`): the launcher value (`testID="infra-coding-launcher"`). When `kubernetes` is an object, its rows from `codingKubernetesRows` (`testID="infra-coding-kubernetes"`). When the launcher is `kubernetes` but `kubernetes` is `null`, "Kubernetes details not reported" (`testID="infra-coding-kubernetes-missing"`).
  - **Coding launcher not configured** (`launcher: local`, which means no container executor): the launcher row reads "Not configured" (`launcherLabel`), followed by muted text "Coding agents can't run on this server. It needs a Docker or Kubernetes launcher." (`CODING_NOT_CONFIGURED_TEXT`, `testID="infra-coding-not-configured"`). Chosen with `isCodingLauncherConfigured` from ticket 2.
- **Label maps collapsed by default (coding block).** In the coding Kubernetes block, `componentLabel` and `managedByLabel` sit behind a `TextButton` disclosure (from `components/ui/actions.tsx`, the same pattern as `run-detail-result-toggle` in `src/runs/MarkdownResult.tsx`):
  - `testID="infra-coding-labels-toggle"`, `expanded` set from local `useState`. Its label, which `TextButton` also uses as the accessible label, is "Show labels (n)" when collapsed and "Hide labels" when expanded.
  - n is the total number of `key=value` entries in this block (`componentLabel` plus `managedByLabel`).
  - Collapsed by default. Expanded shows every entry, one per line, under its row title (an empty map shows "None").
  - It resets to collapsed whenever a refetch brings a new `infra` response (pull-to-refresh, Retry, focus, foreground, and later ticket 7's resync), for example by resetting the state when `infra` changes.
  - To support this, add to `src/infra/format.ts` a `codingLabelGroups(k8s)` (the two maps as `{ label, entries }` via `formatLabels`) and a `labelEntryCount(groups)`, and move the two label-map rows out of `codingKubernetesRows`, updating `__tests__/infra/format.test.ts` so every field still appears exactly once (in a row or a group).
- As a tab screen it has no back control; the header shows only the title "Infrastructure".
- Every control has an accessible label and a `testID`. No `style` function on a control that also has a `className`.
- Until ticket 6 the screen has no tab button, and it can be reached only by its URL (`/infra`).

**Wireframes.** The layout this ticket builds, one frame per state. The Infra tab button (frame A) is added in ticket 6 and is shown here only as the entry point. The Native agents section in frames D and E is added in ticket 5 and is shown so the whole screen is visible. Values in angle brackets come from the fixture under test. Nothing here adds a field outside `infra-info`.

```text
A. Entry point: the Infra tab (tab button added in ticket 6)
+--------------------------------------+
| Runs                            Live |
|                                      |
|  (any tab: Runs, Spend or Settings)  |
|                                      |
+--------------------------------------+
| [list]  | [pie]  | [server] | [gear] |
| Runs    | Spend  | Infra    |Settings|
+--------------------------------------+
  tab-runs  tab-spend tab-infra tab-settings
                       | press (visible label "Infra",
                       |  accessibilityLabel "Infrastructure")
                       v

B. Loading (no data yet)               testID="infra-loading"
+--------------------------------------+
|            Infrastructure            |  header title
+--------------------------------------+
|                                      |
|                 ( o )                |  Spinner
|        Loading infrastructure…       |
|                                      |
+--------------------------------------+
| Runs  | Spend  | Infra * | Settings  |
+--------------------------------------+

C. Error (500, 403 or network)         testID="infra-error"
+--------------------------------------+
|            Infrastructure            |
+--------------------------------------+
|                                      |
|     Couldn't load infrastructure.    |
|                                      |
|               [ Retry ]              |  infra-retry -> refetch()
|                                      |
+--------------------------------------+
| Runs  | Spend  | Infra * | Settings  |
+--------------------------------------+
  (401 never shows this frame: the client signs out
   and the guard returns the user to connect.)

D. Loaded, Kubernetes, labels collapsed (default)
                                       fixture: infra-kubernetes.json
+--------------------------------------+
|            Infrastructure            |
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
| | [ Show labels (<n>) ]            | |  infra-coding-labels-toggle
| +----------------------------------+ |  (expanded=false)
|                                      |
| NATIVE AGENTS          (ticket 5)    |  infra-native (header)
| Launcher           Kubernetes        |  infra-native-launcher
| Warm pool          3 workers         |  infra-native-warm-pool
| +- infra-native-kubernetes --------+ |
| | Namespace        <namespace>     | |
| | Runtime class    Default         | |  (null runtimeClass)
| | Run label        <runLabel>      | |
| | Warm worker      <label>         | |
| | [ Show labels (<n>) ]            | |  infra-native-labels-toggle
| +----------------------------------+ |  (expanded=false)
+--------------------------------------+
| Runs  | Spend  | Infra * | Settings  |
+--------------------------------------+
  <n> = total key=value entries in that block.

D2. Coding labels expanded             press infra-coding-labels-toggle
+--------------------------------------+
| CODING LAUNCHER                      |
| Launcher           Kubernetes        |
| +- infra-coding-kubernetes --------+ |
| | Namespace        <namespace>     | |
| |   ...other rows as in D...       | |
| | Run label hash   <n> characters  | |
| | [ Hide labels ]                  | |  infra-coding-labels-toggle
| | Component labels                 | |  (expanded=true)
| |   <key>=<value>                  | |  every componentLabel entry
| |   <key>=<value>                  | |
| | Managed-by labels                | |
| |   <key>=<value>                  | |  every managedByLabel entry
| +----------------------------------+ |
|                                      |
| NATIVE AGENTS                        |  (native block stays collapsed;
|   ...as in D...                      |   it expands the same way via
+--------------------------------------+   infra-native-labels-toggle)
  Press "Hide labels" -> back to frame D.
  A refetch (pull-to-refresh, Retry, focus, foreground,
  resync) also returns both blocks to collapsed.

E. Not configured                      fixture: infra-unconfigured.json
+--------------------------------------+
|            Infrastructure            |
+--------------------------------------+
| CODING LAUNCHER                      |
| Launcher           Not configured    |  infra-coding-launcher
| Coding agents can't run on this      |  infra-coding-not-configured
| server. It needs a Docker or         |  (muted text; no Kubernetes
| Kubernetes launcher.                 |   block)
|                                      |
| NATIVE AGENTS          (ticket 5)    |
| Native agents aren't configured on   |  infra-native-not-configured
| this server.                         |  (muted text)
+--------------------------------------+
| Runs  | Spend  | Infra * | Settings  |
+--------------------------------------+
```

Long values wrap onto the next line and are never cut off. With `infra.json` (Docker) the screen looks like frame D with "Docker", "2 workers" and no Kubernetes blocks. When `launcher` is `kubernetes` but `kubernetes` is `null`, the coding Kubernetes block in frame D is replaced by "Kubernetes details not reported" (`infra-coding-kubernetes-missing`). Until ticket 6 lands, the tab bar in frames B–E still shows only Runs, Spend and Settings. Until ticket 5 lands, the native block and its toggle in frames D and D2 aren't there.

**Acceptance criteria**

- [ ] The loading, error-with-retry and content states each render with the testIDs above, and Retry calls `refetch`.
- [ ] Pull-to-refresh calls `refetch`, and `refreshing` follows `loading`.
- [ ] `infra.json` shows "Docker" and no Kubernetes block. `infra-kubernetes.json` shows "Kubernetes" and every coding Kubernetes row.
- [ ] `infra-unconfigured.json` (`launcher: local`) shows the launcher row "Not configured" and then the muted text "Coding agents can't run on this server. It needs a Docker or Kubernetes launcher." in `infra-coding-not-configured`, with no Kubernetes block. The words "Local" and "server host" appear nowhere on the screen.
- [ ] In the coding Kubernetes block, the `componentLabel` and `managedByLabel` entries are hidden by default, and `infra-coding-labels-toggle` reads "Show labels (n)" with `accessibilityState.expanded` `false`, where n is the total number of entries in both maps.
- [ ] Pressing the toggle shows every `key=value` entry of both maps, and the toggle reads "Hide labels" with `expanded` `true`. Pressing it again hides them and restores "Show labels (n)".
- [ ] After a refetch brings a new `infra` response, the coding block is collapsed again.
- [ ] `codingLabelGroups` and `labelEntryCount` are in `src/infra/format.ts`, and every coding Kubernetes field still appears exactly once (in `codingKubernetesRows` or `codingLabelGroups`).
- [ ] A `403` shows the error state, not a sign-out. A `401` leaves sign-out to the client (as on other screens).
- [ ] The screen matches wireframes B, C, D (coding section), D2 (coding section) and E (coding section): same order, labels and testIDs.
- [ ] Light and dark mode both render with theme colours (as `__tests__/spend/screen.test.tsx` checks).
- [ ] `app/(tabs)/_layout.tsx` registers `infra` with `href: null`, so the visible tab bar is still Runs, Spend and Settings, and the existing #23 tab-bar tests pass unchanged.
- [ ] AGENTS.md definition of done.

**Tests.** New `__tests__/infra/screen.test.tsx`. It mocks `useInfra` or `session.apiClient` and runs against `infra.json`, `infra-kubernetes.json`, `infra-unconfigured.json`, `invalid_token.json` (status 403) and `internal_error.json`. It includes:

- **Not configured** (`infra-unconfigured.json`): `infra-coding-launcher` has the text "Not configured", `infra-coding-not-configured` has the exact muted text, there is no `infra-coding-kubernetes`, and no text matches "Local" or "server host".
- **Coding labels collapsed by default** (`infra-kubernetes.json`): `infra-coding-labels-toggle` has the text "Show labels (n)", with n computed from the fixture's `kubernetes.componentLabel` and `kubernetes.managedByLabel`, and `accessibilityState` `{ expanded: false }`; no entry from either map is rendered.
- **Expand shows every entry:** after pressing the toggle, every `key=value` from both maps in the fixture is on screen, and the toggle reads "Hide labels" with `expanded: true`.
- **Hide collapses again:** pressing the toggle once more hides every entry and restores "Show labels (n)" with `expanded: false`.
- **Reset on refetch:** expand, then re-render with a new `infra` object (as after pull-to-refresh), and the block is collapsed.

`__tests__/infra/format.test.ts` gets tests for `codingLabelGroups` and `labelEntryCount` against `infra-kubernetes.json` (and an empty map counting 0). `__tests__/navigation.test.tsx` runs unchanged to show the hidden route doesn't add a tab button.

**Depends on.** Tickets 2 and 3.

### Ticket 5: Native agents section

**Scope.** In `app/(tabs)/infra.tsx`, add the **Native agents** section (`testID="infra-native"`) below Coding launcher:

- When `native` is an object, it shows the execution launcher (`testID="infra-native-launcher"`, using `launcherLabel`) and the warm pool size (`testID="infra-native-warm-pool"`, using `warmPoolLabel`). When `native.kubernetes` is an object, it also shows the `nativeKubernetesRows` (`testID="infra-native-kubernetes"`).
- When `native` is `null`, it shows a muted "Native agents aren't configured on this server." (`testID="infra-native-not-configured"`).
- **Label maps collapsed by default (native block).** In the native Kubernetes block, `componentLabel` and `warmPoolLabel` sit behind a `TextButton` disclosure with `testID="infra-native-labels-toggle"` and `expanded` set, exactly like ticket 4's coding toggle: "Show labels (n)" / "Hide labels", where n is the total number of `key=value` entries in this block (`componentLabel` plus `warmPoolLabel`). It is collapsed by default, has its own state (expanding one block doesn't expand the other), and resets to collapsed whenever a refetch brings a new `infra` response. Add `nativeLabelGroups(k8s)` to `src/infra/format.ts` (reusing `labelEntryCount` from ticket 4) and move the two label-map rows out of `nativeKubernetesRows`, with tests.

If a row-builder change is needed, it goes into `src/infra/format.ts` with tests. The loading and error states from ticket 4 cover the whole screen and don't change.

**Wireframes.** The user reaches the screen as in ticket 4 (by URL until ticket 6, then by the Infra tab). Only the Native agents section is new; loading and error look like ticket 4's frames B and C.

```text
N1. Docker native agents               fixture: infra.json
+--------------------------------------+
|            Infrastructure            |
+--------------------------------------+
| CODING LAUNCHER                      |
| Launcher           Docker            |
|                                      |
| NATIVE AGENTS                        |  infra-native (header)
| Launcher           Docker            |  infra-native-launcher
| Warm pool          2 workers         |  infra-native-warm-pool
+--------------------------------------+

N2. Kubernetes native agents, labels collapsed (default)
                                       fixture: infra-kubernetes.json
+--------------------------------------+
| NATIVE AGENTS                        |
| Launcher           Kubernetes        |  infra-native-launcher
| Warm pool          3 workers         |  infra-native-warm-pool
| +- infra-native-kubernetes --------+ |
| | Namespace        <namespace>     | |
| | Runtime class    Default         | |  (null runtimeClass)
| | Run label        <runLabel>      | |
| | Warm worker      <label>         | |
| | [ Show labels (<n>) ]            | |  infra-native-labels-toggle
| +----------------------------------+ |  (expanded=false)
+--------------------------------------+
  Pressing the toggle shows "Hide labels" and lists every
  componentLabel and warmPoolLabel entry under "Component
  labels" and "Warm pool labels", as ticket 4's frame D2
  does for the coding block.

N3. Not configured                     fixture: infra-unconfigured.json
+--------------------------------------+
| NATIVE AGENTS                        |
| Native agents aren't configured on   |  infra-native-not-configured
| this server.                         |  (muted; no launcher or
|                                      |   warm-pool rows)
+--------------------------------------+
```

**Acceptance criteria**

- [ ] `infra.json` shows "Docker" and "2 workers" with no Kubernetes block (frame N1).
- [ ] `infra-kubernetes.json` shows "Kubernetes", "3 workers" and every native Kubernetes row, with the null runtime class shown as "Default" (frame N2).
- [ ] The native `componentLabel` and `warmPoolLabel` entries are hidden by default, and `infra-native-labels-toggle` reads "Show labels (n)" with `expanded` `false`, where n is the total number of entries in both maps.
- [ ] Pressing the toggle shows every entry of both maps and reads "Hide labels" with `expanded` `true`. Pressing it again hides them.
- [ ] The native and coding toggles are independent, and both are collapsed again after a refetch brings a new `infra` response.
- [ ] `infra-unconfigured.json` shows the not-configured state and no launcher or warm-pool rows (frame N3).
- [ ] The Coding launcher section and the loading and error states from ticket 4 are unchanged.
- [ ] AGENTS.md definition of done.

**Tests.** Extend `__tests__/infra/screen.test.tsx` against `infra.json`, `infra-kubernetes.json` and `infra-unconfigured.json`, adding for the native block (`infra-kubernetes.json`):

- **Collapsed by default:** `infra-native-labels-toggle` reads "Show labels (n)", with n from the fixture's `native.kubernetes.componentLabel` and `native.kubernetes.warmPoolLabel`, `expanded: false`, and no entry rendered.
- **Expand shows every entry:** after pressing it, every `key=value` from both maps is on screen, it reads "Hide labels" with `expanded: true`, and the coding toggle is still collapsed.
- **Hide collapses again:** a second press hides every entry.
- **Reset on refetch:** expand both blocks, re-render with a new `infra` object, and both are collapsed.

`__tests__/infra/format.test.ts` gets a `nativeLabelGroups` test against `infra-kubernetes.json`.

**Depends on.** Ticket 4.

### Ticket 6: Infra tab between Spend and Settings

**Scope.** In `app/(tabs)/_layout.tsx` only (plus tests):

- Replace ticket 4's hidden registration with a real tab, still placed between `spend` and `settings`, so the order is Runs, Spend, Infra, Settings: `<Tabs.Screen name="infra" options={{ title: 'Infra', headerTitle: 'Infrastructure', tabBarAccessibilityLabel: 'Infrastructure', tabBarButtonTestID: 'tab-infra' }} />`. The visible label is exactly "Infra"; the `accessibilityLabel` screen readers announce is "Infrastructure" (owner decision).
- In the `tabBarIcon` mapping, add `route.name === 'infra'` → Ionicons `server` (focused) / `server-outline` (unfocused). The existing label and icon renderers already derive `tab-infra-label` and `tab-infra-icon` from the route name.
- Keep everything from #23 unchanged: `fontSize: 14`, `allowFontScaling`, `tabBarAllowFontScaling`, `tabBarLabelPosition: 'below-icon'`, `minWidth: 44` / `minHeight: 44`, and the `48 + 20 * Math.max(1, fontScale) + insets.bottom` bar height. No `numberOfLines` on labels, so a label that is too wide wraps instead of being cut off with "…".
- No change to `app/(tabs)/settings.tsx`: there is no Settings row for Infrastructure.
- Colours stay `colors.tint` / `colors.muted` from `useColors()`.

**Wireframes.** How the user reaches the screen: press the Infra tab from any tab. The screen's own states are ticket 4's frames B–E and ticket 5's frames N1–N3.

```text
T1. Tab bar, default text size, any phone width
+--------------------------------------+
| [list]  | [pie]  | [server] | [gear] |
| Runs    | Spend  | Infra    |Settings|
+--------------------------------------+
  tab-runs  tab-spend tab-infra tab-settings
  Infra: visible label "Infra", accessibilityLabel
  "Infrastructure" (what screen readers announce).

T2. Infra selected (bold label, tint colour, filled icon)
+--------------------------------------+
|            Infrastructure            |  headerTitle
+--------------------------------------+
|   ...ticket 4/5 content...           |
+--------------------------------------+
| [list]  | [pie]  |[SERVER]* | [gear] |
| Runs    | Spend  | *Infra*  |Settings|
+--------------------------------------+

T3. 320 pt wide phone, fontScale 2 (labels 28 pt, ~80 pt per tab)
+--------------------------------------+
| [list]  | [pie]  | [server] | [gear] |
|  Runs   | Spend  |  Infra   | Setti- |
|         |        |          |  ngs   |
+--------------------------------------+
  "Infra" (~60 pt) fits on one line. "Settings" may wrap
  rather than be cut off; see Risks.
```

**Acceptance criteria**

- [ ] The tab bar shows exactly four tabs in the order Runs, Spend, Infra, Settings.
- [ ] The Infra tab's visible label is exactly "Infra", with `accessibilityLabel` "Infrastructure", `testID="tab-infra"`, label `tab-infra-label` and icon `tab-infra-icon` (`server-outline`, or `server` when focused).
- [ ] Pressing the Infra tab opens the Infrastructure screen, with the header title "Infrastructure", and the other tabs still open their screens.
- [ ] At `fontScale: 2` on a 320 pt wide window, every tab keeps `minWidth: 44` / `minHeight: 44`, every label keeps `allowFontScaling` and `fontSize: 14`, and no label sets `numberOfLines`.
- [ ] `app/(tabs)/settings.tsx` is unchanged and has no Infrastructure row.
- [ ] AGENTS.md definition of done.

**Tests.** This ticket changes exactly two test files and no others.

1. **`__tests__/navigation.test.tsx`** (changed). Setup: import `Infra` from `app/(tabs)/infra`, add `'(tabs)/infra': Infra` to `getMockContext`, and give the mocked `session` an `apiClient` whose `getInfra` resolves `src/api/__fixtures__/infra.json`. It checks:
   - "tabs switch between labelled screens" (light and dark): the loop over tab names becomes `['Runs', 'Spend', 'Infra', 'Settings']`, mapping each name to its expected `accessibilityLabel` so `tab-infra` has `accessibilityLabel` "Infrastructure" (the other three keep their visible names), and `tab-infra-label` has the text "Infra". After pressing `tab-infra`, `infra-coding-launcher` shows "Docker" and the header shows "Infrastructure". Pressing `tab-settings` still shows `settings-host`.
   - "tab bar has readable scaling labels, icons and large targets" (#23, light and dark): the loop becomes `['runs', 'spend', 'infra', 'settings']`, so `tab-infra` also has a 44×44 item, `tab-infra-label` has `allowFontScaling` and `fontSize: 14`, and `tab-infra-icon` exists. New lines: before pressing, `tab-infra-icon` shows `server-outline` and `tab-infra-label` has `fontWeight: '400'`. After pressing `tab-infra`, the icon shows `server` and the label has `fontWeight: '700'`.
   - New test "four tabs fit a 320 pt wide phone at fontScale 2": it mocks `useWindowDimensions` with `width: 320`, `height: 568`, `fontScale: 2`. It checks that the tab buttons appear in the order `tab-runs`, `tab-spend`, `tab-infra`, `tab-settings` (by their order in the rendered tree), that `tab-infra-label` has exactly the text "Infra", that every tab label has `allowFontScaling` and `fontSize: 14` and no `numberOfLines` prop, and that every tab item has `minWidth: 44` and `minHeight: 44`.
   - The other tests in the file (sign-in, sign-out, shared live stream) keep passing without edits.
2. **`__tests__/runs/runs.test.tsx`** (changed). Setup: import `Infra`, add `'(tabs)/infra': Infra` to its `getMockContext` so the mocked route tree matches the real tab layout, and add a `getInfra` that resolves `infra.json` to the mocked `session.apiClient()` next to `getRun`. It checks: in "the selected filter survives a tab switch", the test also presses `tab-infra`, sees `infra-coding-launcher`, then presses `tab-runs`, and the `failed` filter is still selected. All its other tests pass without edits.

Not changed, on purpose:

- `__tests__/infra/screen.test.tsx` and `__tests__/infra/useInfra.test.tsx`: the screen and hook don't change, and they already cover the screen's states (tickets 3–5).
- `__tests__/spend/screen.test.tsx` and `__tests__/settings/appearance.test.tsx`: they render their screens directly, not the tab bar.

Fixture: only the existing `src/api/__fixtures__/infra.json`. No new fixture is needed.

**Depends on.** Ticket 5.

### Ticket 7: Reload infrastructure on live-stream resync

**Scope.** In `src/infra/useInfra.ts`, read `resyncVersion` from `useLiveGraph()` (`src/live/useLiveGraph.ts`). When it changes after mount, refetch once, using the same compare-with-previous pattern as `useRunDetail`. Don't react to `run`, `service` or `outcome` events, and don't add event-stream code. The reason is in Summary → Freshness decision. This is a separate ticket so a reviewer can accept or reject it on its own. It changes no screen, so it has no wireframe.

**Acceptance criteria**

- [ ] A `resyncVersion` change triggers exactly one `getInfra()` call. The first render triggers no extra call.
- [ ] Graph changes from `run`, `service` or `outcome` events trigger no `getInfra()` call.
- [ ] No new network or event-stream code outside `src/api/` and `src/live/`.
- [ ] AGENTS.md definition of done.

**Tests.** Extend `__tests__/infra/useInfra.test.tsx`. It mocks `useLiveGraph` as `__tests__/runs/detail.test.tsx` does, against `infra.json` and `infra-kubernetes.json` (the second response after a resync, to show the screen data changes).

**Depends on.** Ticket 3. Land it after ticket 6 so the user-visible flow ships first.

## Risks

- **Tab-label font scaling on small phones.** A fourth tab leaves about 80 pt per tab on a 320 pt wide phone, and since #23 labels are 14 pt and scale with the user's font size (28 pt at `fontScale: 2`). How ticket 6 handles it:
  - The label is the short "Infra" (about 60 pt at 28 pt), not "Infrastructure" (well over 150 pt). The full word stays in the screen's header (`headerTitle`) and in the tab's `accessibilityLabel` ("Infrastructure"), so screen readers announce it.
  - A new `fontScale: 2`, `width: 320` test in `__tests__/navigation.test.tsx` checks the four tabs and their order, the exact "Infra" label, `allowFontScaling`, `fontSize: 14`, 44×44 targets, and that no label sets `numberOfLines`, so labels wrap rather than being cut off.
  - What remains: Jest can't measure rendered text width, so the test can't prove a label fits. The existing "Settings" label (about 105 pt at 28 pt) is wider than 80 pt and may wrap onto two lines in a bar whose height only grows by one line. Ticket 6's "How to try it" asks the reviewer to check a small simulator (iPhone SE size) at the largest text size. Shortening or restyling the Settings label is not planned here (see Open questions).
- **"None" vs. `local`.** The issue asks for "Docker, Kubernetes, or none", and the contract's `launcher` is a required, non-null enum of `local | docker | kubernetes`. Per the owner, `JOB_LAUNCHER=local` means there is no container executor, so the plan shows `local` as the coding section's "Not configured" state (ticket 4). If wardby later gives `local` another meaning (for example running coding agents on the server host), the helper in ticket 2 and the not-configured state in ticket 4 must change with it.
- **Inconsistent payloads.** The schema doesn't tie `kubernetes` to `launcher === 'kubernetes'`. Ticket 4 shows Kubernetes details whenever the object is present and handles `launcher: kubernetes` with `kubernetes: null` explicitly, so neither case crashes or shows a blank.
- **Hidden route before ticket 6.** Ticket 4 relies on `href: null` to keep the new `(tabs)` route out of the tab bar. If that option behaves differently in the installed Expo Router version, the #23 navigation tests fail in ticket 4, which is the intended early warning. The builder checks the versioned docs first.
- **Contract drift.** If a later `@wardby/cli` bump changes `infra-info`, the fixture tests from ticket 1 and the typed helpers from ticket 2 will fail at typecheck or test time. That is the intended early warning. Builders must not hand-edit `openapi.yml` or `schema.ts`.
- **Long values on small screens.** Namespaces, label maps and proxy service names can be long. Rows should wrap (no `numberOfLines` truncation) and be checked at `fontScale: 2`. The label maps are collapsed by default (tickets 4 and 5), which keeps the screen short, but an expanded block can still be long.
- **Sensitive-looking details.** Namespaces and labels are deployment details, shown only to signed-in admins whose token has `admin:view`. Nothing is cached to disk or sent anywhere else. Test fixtures use placeholder values only.
- **403 wording.** Following "the same way as the other screens" means a `403` shows a generic "Couldn't load" error with Retry, and Retry won't help a user without the admin role. This keeps the app consistent. A better message for all screens is listed as an open question rather than done only here.
- **Extra requests.** Reloading on tab focus, on foreground and on resync is a few small GETs. No polling is added, so the AGENTS.md live-data rule holds.

## Open questions

- **Server change for wardby/wardby:** the desktop Viewer's Infrastructure tab may show more than `infra-info` serves (for example live warm-pool occupancy, or cluster or node health). If admins want that on the phone, the server would need to serve it first. This plan uses only today's fields.
- **Server change for wardby/wardby (optional):** an `infra` (or `config`) event on `/admin/api/events` would let the app reload exactly when the configuration changes. Without it, ticket 7 relies on `resync`, on the assumption that infrastructure changes only when the server restarts.
- If the manual check in ticket 6 shows "Settings" wrapping badly at the largest text size, should the tab bar get a follow-up (for example a taller bar for two-line labels)? That would be a separate issue covering all tabs.
- Should a `403` (missing admin role or `admin:view` scope) get its own message on every screen instead of the generic error? If so, that is a separate cross-screen issue covering Runs, Spend, Run detail and Infrastructure.
