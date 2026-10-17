# Plan: Infrastructure screen (issue #65)

## Summary

Add a read-only **Infrastructure** screen that shows where and how the signed-in admin's wardby server runs its work, like the desktop Viewer's Infrastructure tab. It shows two sections:

- **Coding launcher:** the `launcher` value (`local`, `docker` or `kubernetes`) and, when `kubernetes` is an object, its details.
- **Native agents:** `native.launcher`, `native.warmPoolSize` and, when `native.kubernetes` is an object, its details. When `native` is `null`, the section shows a clear "not configured" state.

Data comes from the existing typed client call `getInfra()` in `src/api/client.ts` (`GET /admin/api/infra`, `operationId: getInfra`, schema `infra-info` in `src/api/openapi.yml`). No new endpoint, field or network code is needed. The screen is a new tab route `app/(tabs)/infra.tsx`, shown as a **fourth bottom tab labelled "Infra"**, between Spend and Settings. The tab order becomes Runs, Spend, Infra, Settings. The screen's header title stays "Infrastructure".

**Navigation decision: a fourth tab labelled "Infra", not a Settings row.**

- Infrastructure is a top-level view of the server, next to Runs and Spend, and the desktop Viewer gives it its own tab. A tab puts it one tap away from every screen and matches what admins already know from the Viewer. It sits before Settings so Settings stays last, where users expect it.
- Fit on small phones. `app/(tabs)/_layout.tsx` (since #23) gives every tab label `fontSize: 14` with `allowFontScaling`, `tabBarLabelPosition: 'below-icon'` and `minWidth: 44`, and grows the bar's height with `fontScale`. With four tabs on a 320 pt wide phone (iPhone SE 1st gen; 360 dp is common on small Android phones), each tab gets about 80 pt. "Infrastructure" would need well over 150 pt at `fontScale: 2` (28 pt text), so it can't be the tab label. The short label "Infra" is about 60 pt wide at 28 pt and fits. The label is set by `title: 'Infra'`, and the header keeps the full word through `headerTitle: 'Infrastructure'`.
- Ticket 6 adds the tab and a `fontScale: 2`, 320 pt wide test in `__tests__/navigation.test.tsx`. The remaining font-scaling risk, including the existing "Settings" label, is under Risks.
- The tab adds one `Tabs.Screen` and one icon (Ionicons `server` / `server-outline`) to `app/(tabs)/_layout.tsx`. The icon is already in `@expo/vector-icons`, so no new dependency is needed.

**What the plan assumes about the server.** Only what the vendored contract (`src/api/openapi.yml`) already says:

- `GET /admin/api/infra` returns `infra-info` with the required keys `launcher`, `kubernetes` and `native`. `additionalProperties: false`, and clients must ignore unknown fields.
- `launcher` is one of `local | docker | kubernetes` and is never `null`. The schema has no "none" value (see Open questions).
- `kubernetes` is `null` or `{ namespace, platform, runtimeClass (string|null), proxyService, runLabel, runLabelHashChars, componentLabel (string map), managedByLabel (string map) }`.
- `native` is `null` or `{ launcher: docker|kubernetes, warmPoolSize: integer, kubernetes: null | { namespace, runtimeClass (string|null), runLabel, componentLabel (string map), warmPoolLabel (string map), warmWorkerLabel } }`.
- Errors: `401` and `403` both return `{ "error": "invalid_token" }`, `405` returns `method_not_allowed`, and `default` (500) returns `{ "error": "internal_error", "id": "…" }`.
- The live event stream (`/admin/api/events`) only sends `hello`, `run`, `service`, `outcome`, `status` and `resync` frames. None of them carries infrastructure data.

**Freshness decision.** The screen reloads when its tab gains focus, when the app returns to the foreground (`AppState` → `active`) and on pull-to-refresh. **No `run`, `service` or `outcome` event triggers a reload.** They describe runs, not deployment configuration, and reloading on every run event would hit the server for nothing. Only the existing `resyncVersion` from `useLiveGraph()` triggers a reload (ticket 7). A `resync` happens when the server's live connection comes back, which includes a server restart, and a restart is when the infrastructure configuration can change. This uses the shared stream from `LiveGraphProvider` (in `app/_layout.tsx`) and adds no polling, so the AGENTS.md "Live data" rules hold.

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
| `infra-unconfigured.json` | `launcher: "local"`, `kubernetes: null`, `native: null`. This is the closest the schema gets to "nothing configured".                                                                               | tickets 1–5     |
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
- It loads when the screen gains focus (`useFocusEffect` from `expo-router`, which also fires when the user switches to the tab) and when `AppState` changes to `active`. The listener is removed on unmount.
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
                       | press (accessibilityLabel "Infra")
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

D. Loaded, Kubernetes                  fixture: infra-kubernetes.json
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
| Runs  | Spend  | Infra * | Settings  |
+--------------------------------------+

E. Not configured                      fixture: infra-unconfigured.json
+--------------------------------------+
|            Infrastructure            |
+--------------------------------------+
| CODING LAUNCHER                      |
| Launcher   Local (on the server host)|  infra-coding-launcher
|                                      |  (no Kubernetes block; the
|                                      |   schema has no "none" value)
| NATIVE AGENTS          (ticket 5)    |
| Native agents aren't configured on   |  infra-native-not-configured
| this server.                         |  (muted text)
+--------------------------------------+
| Runs  | Spend  | Infra * | Settings  |
+--------------------------------------+
```

Long values wrap onto the next line and are never cut off. With `infra.json` (Docker) the screen looks like frame D with "Docker", "2 workers" and no Kubernetes blocks. When `launcher` is `kubernetes` but `kubernetes` is `null`, the Kubernetes block in frame D is replaced by "Kubernetes details not reported" (`infra-coding-kubernetes-missing`). Until ticket 6 lands, the tab bar in frames B–E still shows only Runs, Spend and Settings.

**Acceptance criteria**

- [ ] The loading, error-with-retry and content states each render with the testIDs above, and Retry calls `refetch`.
- [ ] Pull-to-refresh calls `refetch`, and `refreshing` follows `loading`.
- [ ] `infra.json` shows "Docker" and no Kubernetes block. `infra-kubernetes.json` shows "Kubernetes" and every coding Kubernetes row. `infra-unconfigured.json` shows "Local (on the server host)".
- [ ] A `403` shows the error state, not a sign-out. A `401` leaves sign-out to the client (as on other screens).
- [ ] The screen matches wireframes B, C, D (coding section) and E (coding section): same order, labels and testIDs.
- [ ] Light and dark mode both render with theme colours (as `__tests__/spend/screen.test.tsx` checks).
- [ ] `app/(tabs)/_layout.tsx` registers `infra` with `href: null`, so the visible tab bar is still Runs, Spend and Settings, and the existing #23 tab-bar tests pass unchanged.
- [ ] AGENTS.md definition of done.

**Tests.** New `__tests__/infra/screen.test.tsx`. It mocks `useInfra` or `session.apiClient` and runs against `infra.json`, `infra-kubernetes.json`, `infra-unconfigured.json`, `invalid_token.json` (status 403) and `internal_error.json`. `__tests__/navigation.test.tsx` runs unchanged to show the hidden route doesn't add a tab button.

**Depends on.** Tickets 2 and 3.

### Ticket 5: Native agents section

**Scope.** In `app/(tabs)/infra.tsx`, add the **Native agents** section (`testID="infra-native"`) below Coding launcher:

- When `native` is an object, it shows the execution launcher (`testID="infra-native-launcher"`, using `launcherLabel`) and the warm pool size (`testID="infra-native-warm-pool"`, using `warmPoolLabel`). When `native.kubernetes` is an object, it also shows the `nativeKubernetesRows` (`testID="infra-native-kubernetes"`).
- When `native` is `null`, it shows a muted "Native agents aren't configured on this server." (`testID="infra-native-not-configured"`).

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

N2. Kubernetes native agents           fixture: infra-kubernetes.json
+--------------------------------------+
| NATIVE AGENTS                        |
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
- [ ] `infra-unconfigured.json` shows the not-configured state and no launcher or warm-pool rows (frame N3).
- [ ] The Coding launcher section and the loading and error states from ticket 4 are unchanged.
- [ ] AGENTS.md definition of done.

**Tests.** Extend `__tests__/infra/screen.test.tsx` against `infra.json`, `infra-kubernetes.json` and `infra-unconfigured.json`.

**Depends on.** Ticket 4.

### Ticket 6: Infra tab between Spend and Settings

**Scope.** In `app/(tabs)/_layout.tsx` only (plus tests):

- Replace ticket 4's hidden registration with a real tab, still placed between `spend` and `settings`, so the order is Runs, Spend, Infra, Settings: `<Tabs.Screen name="infra" options={{ title: 'Infra', headerTitle: 'Infrastructure', tabBarAccessibilityLabel: 'Infra', tabBarButtonTestID: 'tab-infra' }} />`. The visible label is exactly "Infra".
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
- [ ] The Infra tab's visible label is exactly "Infra", with `accessibilityLabel` "Infra", `testID="tab-infra"`, label `tab-infra-label` and icon `tab-infra-icon` (`server-outline`, or `server` when focused).
- [ ] Pressing the Infra tab opens the Infrastructure screen, with the header title "Infrastructure", and the other tabs still open their screens.
- [ ] At `fontScale: 2` on a 320 pt wide window, every tab keeps `minWidth: 44` / `minHeight: 44`, every label keeps `allowFontScaling` and `fontSize: 14`, and no label sets `numberOfLines`.
- [ ] `app/(tabs)/settings.tsx` is unchanged and has no Infrastructure row.
- [ ] AGENTS.md definition of done.

**Tests.** In `__tests__/navigation.test.tsx`:

- Add `'(tabs)/infra': Infra` to `getMockContext`, and give the mocked `session` an `apiClient` whose `getInfra` resolves `src/api/__fixtures__/infra.json`.
- Add `'Infra'` to the "tabs switch between labelled screens" loop, press `tab-infra`, and check that `infra-coding-launcher` shows "Docker".
- Add `'infra'` to the existing #23 "tab bar has readable scaling labels" loop.
- Add a new test that mocks `useWindowDimensions` with `width: 320`, `fontScale: 2`. It checks that the four tab buttons appear in the order `tab-runs`, `tab-spend`, `tab-infra`, `tab-settings`, that `tab-infra-label` has the text "Infra", `allowFontScaling` and `fontSize: 14`, that no tab label has a `numberOfLines` prop, and that each tab item has `minWidth: 44` and `minHeight: 44`.

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
  - The label is the short "Infra" (about 60 pt at 28 pt), not "Infrastructure" (well over 150 pt). The full word stays in the screen's header (`headerTitle`).
  - A new `fontScale: 2`, `width: 320` test in `__tests__/navigation.test.tsx` checks the four tabs and their order, the exact "Infra" label, `allowFontScaling`, `fontSize: 14`, 44×44 targets, and that no label sets `numberOfLines`, so labels wrap rather than being cut off.
  - What remains: Jest can't measure rendered text width, so the test can't prove a label fits. The existing "Settings" label (about 105 pt at 28 pt) is wider than 80 pt and may wrap onto two lines in a bar whose height only grows by one line. Ticket 6's "How to try it" asks the reviewer to check a small simulator (iPhone SE size) at the largest text size. Shortening or restyling the Settings label is not planned here (see Open questions).
- **"None" vs. `local`.** The issue asks for "Docker, Kubernetes, or none", but the contract's `launcher` is a required, non-null enum of `local | docker | kubernetes`. The plan shows `local` as "Local (on the server host)" and gives the coding section no "not configured" state, because the server can't express one. If wardby/wardby adds one, a follow-up ticket is needed (see Open questions).
- **Inconsistent payloads.** The schema doesn't tie `kubernetes` to `launcher === 'kubernetes'`. Ticket 4 shows Kubernetes details whenever the object is present and handles `launcher: kubernetes` with `kubernetes: null` explicitly, so neither case crashes or shows a blank.
- **Hidden route before ticket 6.** Ticket 4 relies on `href: null` to keep the new `(tabs)` route out of the tab bar. If that option behaves differently in the installed Expo Router version, the #23 navigation tests fail in ticket 4, which is the intended early warning. The builder checks the versioned docs first.
- **Contract drift.** If a later `@wardby/cli` bump changes `infra-info`, the fixture tests from ticket 1 and the typed helpers from ticket 2 will fail at typecheck or test time. That is the intended early warning. Builders must not hand-edit `openapi.yml` or `schema.ts`.
- **Long values on small screens.** Namespaces, label maps and proxy service names can be long. Rows should wrap (no `numberOfLines` truncation) and be checked at `fontScale: 2`.
- **Sensitive-looking details.** Namespaces and labels are deployment details, shown only to signed-in admins whose token has `admin:view`. Nothing is cached to disk or sent anywhere else. Test fixtures use placeholder values only.
- **403 wording.** Following "the same way as the other screens" means a `403` shows a generic "Couldn't load" error with Retry, and Retry won't help a user without the admin role. This keeps the app consistent. A better message for all screens is listed as an open question rather than done only here.
- **Extra requests.** Reloading on tab focus, on foreground and on resync is a few small GETs. No polling is added, so the AGENTS.md live-data rule holds.

## Open questions

- **Server change for wardby/wardby:** should `infra-info.launcher` allow a "no coding launcher configured" value (for example `null` or `"none"`)? Today the screen can't tell "not configured" apart from `local`.
- **Server change for wardby/wardby:** the desktop Viewer's Infrastructure tab may show more than `infra-info` serves (for example live warm-pool occupancy, or cluster or node health). If admins want that on the phone, the server would need to serve it first. This plan uses only today's fields.
- **Server change for wardby/wardby (optional):** an `infra` (or `config`) event on `/admin/api/events` would let the app reload exactly when the configuration changes. Without it, ticket 7 relies on `resync`, on the assumption that infrastructure changes only when the server restarts.
- If the manual check in ticket 6 shows "Settings" wrapping badly at the largest text size, should the tab bar get a follow-up (for example a taller bar for two-line labels)? That would be a separate issue covering all tabs.
- Should screen readers hear "Infrastructure" instead of "Infra" for the tab? The plan uses "Infra" for both the visible and the accessible label, matching the other tabs.
- Should a `403` (missing admin role or `admin:view` scope) get its own message on every screen instead of the generic error? If so, that is a separate cross-screen issue covering Runs, Spend, Run detail and Infrastructure.
- Should the label maps (`componentLabel`, `managedByLabel`, `warmPoolLabel`) be collapsed behind a `TextButton` disclosure (`expanded`) by default to keep the screen short? The plan shows them expanded. A follow-up can add the disclosure.
- Is "Local (on the server host)" the right wording for `launcher: local`? Please confirm it matches the desktop Viewer.
