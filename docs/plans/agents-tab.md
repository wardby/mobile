# Plan: Agents tab for wardby mobile

## Summary

The Claude Code pane (`wardby-runs`) has an **Agents** tab beside Runs. It shows every agent grouped into **flows** (agents linked by delegation, PR review, fix rounds, after-merge triggers and Jira status hand-offs), what starts each agent, its model and budget, and its last runs. An admin uses it to answer "what is set up, and how does work move between agents?".

The mobile app today shows runs (`app/(tabs)/index.tsx`), spend (`app/(tabs)/spend.tsx`) and infra (`app/(tabs)/infra.tsx`), but not the agents themselves. This plan adds a fifth tab, **Agents**, with three screens:

1. **Agents list**: flows as sections, each with a one-line strip (`⚡ mention → builder → PR → reviewer ↺ fix ≤2 → merged`) and one row per agent. Unlinked agents go in a closed fold at the bottom.
2. **Agent detail**: what starts it, model and budget, connections (names only), the first line of its prompt, and its last runs.
3. **Flow**: the flow drawn as a vertical tree (the terminal pane's `flowTree`, not the desktop SVG map), with recent runs in the flow.

The companion design document ("Agents tab: mobile design") has a board for each screen and its states.

Mobile tickets, in order (all wait for the server prerequisite below):

1. Contract bump, `getAgents` / `getAgent` and agents fixtures (gate).
2. Agent model: roles, tones, entry chips and filter.
3. Flow text: `flowStrip` and `flowTree`.
4. Run stats per agent and per flow from the live graph.
5. `useAgents()` hook.
6. Agents tab and list screen with its states.
7. Agents list: Unlinked fold, hidden note and filter.
8. `useAgent(id)` hook.
9. Agent detail screen.
10. Flow screen.
11. Agent detail → Runs, and Run detail → agent.
12. Flow → Runs: filter the Runs tab by several agents.
13. Accessibility pass.

### What already exists

- **Plugin** (wardby repo, not in this repository, so these references were not checked here): `plugins/claude-code/hooks/register.tsx`.
  - Tab state: R:160.
  - Data: `list_agent_links` (R:2531).
  - Roles and colours: R:429 and R:1743.
  - Strip: `flowStrip` (R:378).
  - Tree: `flowTree` (R:491).
  - Detail cards: R:3095.
  - Flow view: R:3254.
- **Server** (wardby repo, not checked here): `src/core/agent-flows.ts` (`buildAgentFlows`) is a pure function that the MCP tool `list_agent_links` (`src/mcp/tools/agent-links.ts`) already shares "with the admin viewer". Link facts only, never secrets.
- **Mobile**: the app talks **only** to the viewer API. `npm run api:sync` (`src/api/sync-contract.cjs`, `CLI_VERSION = '0.9.6'` today) copies `docs/viewer-api.openapi.yml` out of the pinned `@wardby/cli` package into `src/api/openapi.yml`, and `npm run api:generate` builds `src/api/schema.ts`. Both are generated and never hand-edited.
  - The vendored contract has four paths: `/admin/api/graph` (`getGraph`), `/admin/api/runs/{id}` (`getRun`), `/admin/api/infra` (`getInfra`) and `/admin/api/events` (`getEvents`). `createApiClient` in `src/api/client.ts` wraps the first three; `src/live/stream.ts` opens the events stream.
  - **No viewer endpoint returns agents or flows.** The graph only knows agents through runs: each run carries `agentId`, `agentName`, `agentKind`, `model`, `codingProvider` and `budgetUsd`. An agent with no run in the window is invisible.
  - The live event stream has `run`, `service`, `outcome` and `step` events; nothing about agents.
- **Reusable mobile code**:
  - `useInfra()` (`src/infra/useInfra.ts`): the pattern for a non-graph fetch (load on focus and on app foreground, reload on `resyncVersion`, drop stale responses).
  - `useLiveGraph()` (`src/live/useLiveGraph.ts`): the graph holds runs for the Runs tab's range (`1h`, `6h`, `24h` default, `7d`; `src/runs/timeRange.ts`), at most 500 runs (`truncated` says when more exist).
  - `src/runs/agentFilter.ts` (`agentOptions`, `matchesAgent`) and the Runs tab's `agent` / `agentNavigation` route params, already used by Spend's per-agent rows (`openAgent` in `app/(tabs)/spend.tsx`).
  - `asChains` (`src/runs/prChains.ts`), `ChainHeading`, `RunRow`, `statusStyle` (`src/runs/status.ts`), `formatCost` and `formatBudget` (`src/runs/format.ts`).
  - `statusTokens` in `components/ui/theme.ts` (blue, green, red, orange, grey) and `NavigationRow`, `TextButton` and `MenuButton` from `src/ui/interactions.tsx`.
  - `react-native-svg` is already a dependency (`package.json`), used indirectly by `lucide-react-native` icons.

### What the plan assumes about the wardby server

The mobile app cannot call MCP tools, so it cannot reuse `list_agent_links`. Everything below is a **wardby server change that does not exist yet**. It is a prerequisite, built and released in the wardby repo, and is **not** a ticket a builder runs in this repository. Mobile ticket 1 starts only when a `@wardby/cli` release ships it.

**Server prerequisite (wardby repo): `GET /admin/api/agents` and `GET /admin/api/agents/{id}` on the viewer API.**

- Both need `admin:view` and the admin role, like every other viewer path.
- `GET /admin/api/agents` returns `buildAgentFlows` output for every agent in the deployment (`all: true` semantics): `{ agents, edges, flows, unlinked, hidden }`.
  - Per agent, the same fields as `list_agent_links`: `id, name, kind, codingProvider, model, budgetUsd, budgetGroup, promptFirstLine, entry[], repositories[], notes[]`.
  - Each flow has a **stable, URL-safe `key`** (mobile uses it as a route param and in testIDs) and lists its agent ids and edges. This is an assumption; ticket 1 checks it.
  - `agents[].id` is the same id as `agentId` on graph runs, so run stats can be joined.
- `GET /admin/api/agents/{id}` returns the same row plus `mcpServers` (names), `toolNames`, `secretNames` (names only, never values), Claude Code `skills` and `sessionResume`, and `budgetOverrunPct`. An unknown id returns 404 `not_found`, like `getRun`.
- **No full system prompt** on the viewer API (see open questions).
- Both are added to the viewer contract with the same 401/403/405/default(500) responses as `getInfra` (`getInfra` has no 400, so neither needs one), and the contract's `info.description` lists them.
- **No live event** is added. Agents change rarely, so mobile refetches on focus, on foreground, on resync and on pull-to-refresh.
- **Older servers.** A server without the endpoint is assumed to answer `GET /admin/api/agents` with HTTP 404. The body is not relied on (it may not be the `not_found` JSON). This is the only way mobile tells an older server apart; ticket 1 records what a 0.9.6 server really returns.

### Out of scope

- Editing agents, triggering runs, or changing schedules.
- The desktop SVG flow map.
- Showing the full system prompt.
- Agent change events on the live stream.
- Rebuilding flows on the phone for older servers.

## Why a plan

The feature needs a server endpoint that does not exist, a contract bump, three new screens, a new tab, a new kind of Runs filter and links between screens. Built in one go it would be one large PR that no reviewer can check line by line, and it would mix a contract change with UI. Split into small tickets, each PR keeps AGENTS.md's definition of done on its own, and the contract gate (ticket 1) stops the work early if the server ships a different shape.

### Changes from version 1 (review against the code)

- The vendored contract lives at `src/api/openapi.yml` (copied from the CLI package's `docs/viewer-api.openapi.yml`), and it has no `documents` endpoint: only `graph`, `runs/{id}`, `infra` and `events`.
- `react-native-svg` is already installed, so "no `react-native-svg` dependency" was wrong. The tree is still preferred, for reading at phone width, not to avoid a dependency.
- The server change is a prerequisite in the wardby repo, not ticket 0 in this plan: a mobile builder run cannot do it.
- `useAgents()` follows `useInfra()` (focus, foreground, resync, pull-to-refresh) instead of a new 2 s backoff scheme that nothing else in the app uses.
- Run stats only cover the live graph's window (the Runs tab's range, 500 runs at most). Detail says so, instead of implying "last runs" ever.
- The Runs tab filters by one agent (`agent` route param, `matchesAgent`). "Open in Runs" for a whole flow needs a new multi-agent filter, so it is its own ticket (12).
- New stack routes must be registered in `app/_layout.tsx` inside the signed-in `Stack.Protected`, beside `runs/[id]`.
- `__tests__/navigation.test.tsx` lists the tabs by name; adding a tab changes it.
- On `GET /admin/api/agents/{id}`, a 404 cannot tell "older server" from "agent deleted". Only the list endpoint decides "unsupported".
- Large tickets were split: the model (2, 3), run stats (4), the list (6, 7), detail (8, 9) and cross-links (11, 12).

### Design decisions

- **Read-only.** Same as the rest of the app: no create, edit, trigger or schedule changes.
- **Flows come from the server.** Mobile never rebuilds edges on its own. The pane's client-side union-find fallback for older servers is not ported. If `GET /admin/api/agents` answers 404, the tab shows "Agents needs a newer wardby server" (naming the release that ships the endpoint) and the other tabs keep working.
- **Run stats come from `useLiveGraph()`.** Last-3 status dots, run count and spend per agent and per flow come from the graph the app already holds (AGENTS.md: screens get runs only from `useLiveGraph()`, never by polling). No extra run calls. The numbers cover the Runs tab's current range, and the UI names it ("in the last 24 hours"). When `graph.truncated` is true, the stats say "at least".
- **One cache for agents.** The list, Detail and Flow screens read the same `useAgents()` data, so opening a flow never refetches. The cache is per session and is cleared on sign-out (`session.signOut` in `src/auth/session.ts`), so a new server never sees the old server's agents.
- **Roles and colours map to the app's status tones** (`statusTokens`), not the pane's hexes:
  - lead → blue
  - reviewer → green
  - manual → orange
  - sub → grey
  - related → grey, with a dashed left border

  The role is shown as a 4 pt left bar on the row plus a text label, so colour is never the only signal. The accent colour (`useColors().tint`) stays reserved for interactive elements. Colours come from `statusTokens` / `useColors()` inline styles, never ad-hoc `StyleSheet` colours.

- **Tree, not map.** The phone gets the terminal-style tree (`⇢` delegation, `→ PR opened`, `↺ fix ≤2 → back to X`), rendered as plain `Text`. An SVG map can be a later ticket if the tree reads badly; `react-native-svg` is already installed if it comes to that.
- **One filter** ("Filter by agent, model or repository"), the same matching as the pane: case-insensitive, commas are OR. While filtering, every flow opens.
- **Navigation into Runs** reuses what exists:
  - "Runs" on Detail navigates to `/(tabs)` with `agent` and an `agentNavigation` counter, exactly as `openAgent` in `app/(tabs)/spend.tsx` does.
  - "Open in Runs" on Flow needs a new `agents` param (comma-separated ids) and a `matchesAgents` helper in `src/runs/agentFilter.ts` (ticket 12).
  - Run detail (`app/runs/[id].tsx`) gains a link to its agent, shown only when the agents endpoint is supported.
- **Server text is plain text.** Names, `promptFirstLine`, notes and repositories render as `Text`, never through `MarkdownResult` or links.

### testIDs

| Element         | testID                                                                                 |
| --------------- | -------------------------------------------------------------------------------------- |
| Screens         | `screen-agents`, `screen-agent-detail`, `screen-agent-flow`                            |
| Tab             | `tab-agents` (icon `tab-agents-icon`, label `tab-agents-label`, both not accessible)   |
| Flow section    | `agent-flow-row-<flowKey>`                                                             |
| Agent row       | `agent-row-<agentId>`                                                                  |
| Unlinked fold   | `agents-unlinked-toggle`                                                               |
| Hidden note     | `agents-hidden`                                                                        |
| Filter          | `agents-filter`, `agents-filter-clear`                                                 |
| States          | `agents-loading`, `agents-empty`, `agents-unsupported`, `agents-error`, `agents-retry` |
| Detail actions  | `agent-detail-runs`, `agent-detail-flow`                                               |
| Detail states   | `agent-detail-loading`, `agent-detail-not-found`, `agent-detail-error`                 |
| Flow action     | `agent-flow-open-runs`                                                                 |
| Last run row    | `agent-run-row-<runId>`                                                                |
| Run detail link | `run-detail-agent`                                                                     |
| Runs flow chip  | `runs-agents-clear`                                                                    |

### Fixtures

All in `src/api/__fixtures__/`, written to match the typed examples in `src/api/__tests__/fixtures.test.ts`. Names are invented; `secretNames` hold obviously fake names, never values or tokens.

| Fixture                                 | Content                                                                                                                                                                                                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `agents.json`                           | 3 flows, covering every edge kind:<br>• a mention → builder → reviewer ↺ fix flow<br>• a Jira status hand-off flow, with a person-only status<br>• a scheduled lead with 2 sub-agents, one shared<br>Also 2 unlinked agents and `hidden: { agents: 1, edges: 2 }`. Agent ids match runs in `graph.json` where stats are tested. |
| `agents-empty.json`                     | `{ agents: [], edges: [], flows: [], unlinked: [], hidden: { agents: 0, edges: 0 } }`                                                                                                                                                                                                                                           |
| `agent-detail.json`                     | A coding agent with MCP servers, a tool secret name, skills and an overrun                                                                                                                                                                                                                                                      |
| `agent-detail-native.json`              | A native agent with no repository                                                                                                                                                                                                                                                                                               |
| `not_found.json` (exists)               | 404 body for an unknown agent id                                                                                                                                                                                                                                                                                                |
| 404 with no JSON body (inline in tests) | A server without the endpoint, to test the unsupported state                                                                                                                                                                                                                                                                    |

## Tickets

Every ticket keeps AGENTS.md's definition of done: `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm test` pass, then `npm run export -- --platform web` runs once, last. Network code is tested only against recorded fixtures. The PR says `Resolves #<issue>`, copies the ticket's checklist ticked, and has a "How to try it" section. No ticket adds a dependency, a hardcoded host, a secret, phone-home code, or changes under `.github/`, `ios/` or `android/`; a ticket that seems to need one stops and reports instead.

| #   | Ticket                                                   | Depends on     |
| --- | -------------------------------------------------------- | -------------- |
| —   | Server prerequisite (wardby repo, above)                 | —              |
| 1   | Contract bump, `getAgents` / `getAgent`, fixtures (gate) | server release |
| 2   | Agent model: roles, tones, entry chips, filter           | 1              |
| 3   | Flow text: `flowStrip`, `flowTree`                       | 1              |
| 4   | Run stats from the live graph                            | 1              |
| 5   | `useAgents()` hook                                       | 1              |
| 6   | Agents tab and list screen with states                   | 2, 3, 4, 5     |
| 7   | Unlinked fold, hidden note, filter                       | 6              |
| 8   | `useAgent(id)` hook                                      | 5              |
| 9   | Agent detail screen                                      | 4, 8           |
| 10  | Flow screen                                              | 3, 4, 6        |
| 11  | Detail → Runs, Run detail → agent                        | 9              |
| 12  | Flow → Runs (multi-agent filter)                         | 10             |
| 13  | Accessibility pass                                       | 7, 9, 10, 12   |

### Ticket 1: Contract bump, `getAgents` / `getAgent` and fixtures (gate)

**This ticket's PR is a gate.** If the published contract differs from "What the plan assumes about the wardby server" (paths, field names, flow `key`, the 404 for unknown ids), the builder stops and reports the differences in the PR, and tickets 2–13 are re-planned before any is built.

**Scope**

- `src/api/sync-contract.cjs`: set `CLI_VERSION` to the release that ships the endpoints. Run `npm run api:sync`, then `npm run api:generate`; commit `src/api/openapi.yml` and `src/api/schema.ts` together, unedited.
- `src/api/client.ts`: add `getAgents()` (`/admin/api/agents`) and `getAgent(id)` (`/admin/api/agents/${encodeURIComponent(id)}`), typed from `paths` like `getInfra` and `getRun`.
- New `src/api/agentsSupport.ts` (pure): `isAgentsUnsupported(error)` is true only for an `ApiError` with `status === 404` from the list call, whatever its `code`.
- Fixtures from the table above; typed examples and `satisfies JsonShape<…>` checks in `src/api/__tests__/fixtures.test.ts`.
- Fix anything the new types break; no UI.

**Acceptance criteria**

- [ ] `CLI_VERSION` bumped; `openapi.yml` and `schema.ts` regenerated, not hand-edited, committed together; `node_modules` and `package-lock.json` unchanged.
- [ ] `getAgents` and `getAgent` send the bearer header and throw `ApiError` with the server's `code` and request id, like `getInfra`.
- [ ] `getAgent` encodes the id.
- [ ] `isAgentsUnsupported` is true for 404 with and without a JSON body, false for 401, 403, 500 and network errors.
- [ ] All new fixtures type-check against the generated schema; no secret values or token-shaped strings in them.
- [ ] The PR records the real flow shape (`key`, agent ids, edges), what a 0.9.6 server returns for `/admin/api/agents`, and whether the contract matches the plan.

**Tests**

- `src/api/__tests__/client.test.ts`: extend the success case to `getAgents` (`agents.json`) and `getAgent` (`agent-detail.json`); errors with `invalid_token.json`, `not_found.json`, `internal_error.json`.
- `src/api/__tests__/fixtures.test.ts` for every new fixture.
- New `src/api/__tests__/agentsSupport.test.ts` (inline 404 with no body).
- `src/api/__tests__/schema.test.js` unchanged and passing.

**Depends on**: the server prerequisite, released in `@wardby/cli`. No new dependency.

### Ticket 2: Agent model — roles, tones, entry chips and filter

**Scope**

- New `src/agents/model.ts` (pure), ported from the plugin's role logic: `agentRole(agent, flow)` → `lead | reviewer | manual | sub | related`, `roleTone(role)` → a `statusTokens` key, `roleLabel(role)`, `entryChip(entry)` (what starts the agent: mention, schedule, webhook, Jira status, manual), and `filterAgents(data, query)` (case-insensitive; commas are OR; matches name, model and repository; returns matching flows with only matching agents, and matching unlinked agents).

**Acceptance criteria**

- [ ] Every role maps to a tone and a text label; `related` is flagged for the dashed border.
- [ ] Unknown entry kinds produce a neutral chip, never a throw.
- [ ] Filter: empty or whitespace query returns everything; `"opus, acme/web"` returns agents matching either; matching is case-insensitive.

**Tests**: new `__tests__/agents/model.test.ts` against `agents.json`.

**Depends on**: Ticket 1.

### Ticket 3: Flow text — `flowStrip` and `flowTree`

**Scope**

- New `src/agents/flowText.ts` (pure): `flowStrip(flow, agents)` returns the one-line strip; `flowTree(flow, agents)` returns lines `{ depth, text, agentId? }` for the vertical tree (`⇢` delegation, `→ PR opened`, `↺ fix ≤2 → back to X`, after-merge and Jira hand-offs).
- Each line also has `label`: the same text with no symbols, for accessibility.

**Acceptance criteria**

- [ ] Every edge kind in `agents.json` renders in strip and tree.
- [ ] A shared sub-agent appears under each lead that uses it; a cycle (fix round) never loops forever.
- [ ] No `label` contains `⚡`, `⇢`, `→`, `↺` or `≤`.

**Tests**: new `__tests__/agents/flowText.test.ts` against `agents.json`, snapshot-free string assertions.

**Depends on**: Ticket 1.

### Ticket 4: Run stats from the live graph

**Scope**

- New `src/agents/runStats.ts` (pure): `agentRunStats(graph, agentId)` and `flowRunStats(graph, agentIds)` return `{ runs, costUsd, lastStatuses (up to 3, newest first), lastRuns, partial }` from `graph.runs`. `partial` is `graph.truncated`. `null` graph returns empty stats.
- Uses `RunStatus` and `statusStyle` from `src/runs/status.ts`; no network.

**Acceptance criteria**

- [ ] Counts and cost match a hand-computed sum over `graph.json` for one agent and one flow.
- [ ] An agent with no runs in the graph gets `runs: 0` and no statuses.
- [ ] `partial` follows `truncated`.

**Tests**: new `__tests__/agents/runStats.test.ts` against `graph.json`, `graph-chains.json` and `agents.json`.

**Depends on**: Ticket 1.

### Ticket 5: `useAgents()` hook

**Scope**

- New `src/agents/useAgents.ts`, modelled on `useInfra()`: loads on focus (`useFocusEffect`) and on app foreground, reloads when `resyncVersion` from `useLiveGraph()` changes, exposes `refetch` for pull-to-refresh, and drops stale responses with a request counter.
- Returns `{ data, loading, error, unsupported, refetch }`; `unsupported` comes from `isAgentsUnsupported`.
- Data is held in one module-level store shared by every screen that calls the hook (focus on the list does not refetch if data is younger than 5 minutes; pull-to-refresh always does). The store is cleared on sign-out.
- Uses `session.apiClient()` only; no `fetch` outside `src/api/`.

**Acceptance criteria**

- [ ] First focus loads once; a second focus within 5 minutes does not; after 5 minutes it does.
- [ ] Resync and foreground reload; pull-to-refresh always reloads.
- [ ] A 404 sets `unsupported` and no `error`; other failures set `error` and keep the last data.
- [ ] Sign-out clears the store; a slow response after sign-out is dropped.

**Tests**: new `__tests__/agents/useAgents.test.tsx` with a fake client returning `agents.json`, `agents-empty.json`, a 404 and `internal_error.json`, following `__tests__/infra/useInfra.test.tsx`; fake timers for the 5-minute rule.

**Depends on**: Ticket 1.

### Ticket 6: Agents tab and list screen with states

**Scope**

- New `app/(tabs)/agents.tsx` (root `screen-agents`): a list of flow sections (`agent-flow-row-<flowKey>`, strip from `flowStrip`, `NavigationRow` to the Flow screen) and agent rows (`agent-row-<agentId>`: role bar and label, name, entry chip, model, budget via `formatBudget`, last-3 status dots from `agentRunStats`; `NavigationRow` to Detail). `RefreshControl` calls `refetch`.
- States: `agents-loading`, `agents-empty` ("No agents on this server"), `agents-unsupported` ("Agents needs a newer wardby server", naming the release), `agents-error` with `agents-retry` (`TextButton`).
- `app/(tabs)/_layout.tsx`: a `Tabs.Screen name="agents"` second, after Runs (`title: 'Agents'`, `tabBarAccessibilityLabel: 'Agents'`, `tabBarButtonTestID: 'tab-agents'`), and the `people` / `people-outline` Ionicons icon in the `tabBarIcon` mapping.
- Detail and Flow routes may not exist yet: rows push `/agents/[id]` and `/agents/flow/[key]`, and this ticket registers both in `app/_layout.tsx` with `Placeholder` screens (`src/navigation/Placeholder.tsx`) so the bundle and tests stay green.

**Acceptance criteria**

- [ ] The tab bar shows Runs, Agents, Spend, Infra, Settings; each tab button keeps its label, testID and 44 pt target.
- [ ] Every state renders with its testID; the unsupported state does not affect other tabs.
- [ ] Rows show role as text and bar; colours come from `statusTokens`; the accent is used only on controls.
- [ ] Pull-to-refresh reloads.

**Tests**: new `__tests__/agents/screen.test.tsx` against `agents.json`, `agents-empty.json`, an inline 404 and `internal_error.json`, with `graph.json` for dots; update `__tests__/navigation.test.tsx` (tab list and labels) and `__tests__/layouts.test.tsx` if it lists routes.

**Depends on**: Tickets 2, 3, 4 and 5.

### Ticket 7: Unlinked fold, hidden note and filter

**Scope**

- `app/(tabs)/agents.tsx`: the Unlinked fold at the bottom, closed by default (`agents-unlinked-toggle`, `TextButton` with `expanded`); the hidden note (`agents-hidden`, "1 agent and 2 links are hidden") shown only when `hidden` is non-zero; the filter field (`agents-filter`, "Filter by agent, model or repository") with a clear button (`agents-filter-clear`) using `filterAgents`. While filtering, every flow and the Unlinked fold open; "No agents match" when nothing matches.

**Acceptance criteria**

- [ ] The fold starts closed and announces its expanded state.
- [ ] The hidden note appears for `agents.json` and not for `agents-empty.json`.
- [ ] Filtering by a model, a repository and a comma list each shows the right rows; clearing restores the folds.

**Tests**: extend `__tests__/agents/screen.test.tsx` against `agents.json`.

**Depends on**: Ticket 6.

### Ticket 8: `useAgent(id)` hook

**Scope**

- New `src/agents/useAgent.ts`: shows the row from the `useAgents()` store at once, then loads `getAgent(id)` for the detail fields (focus, foreground, resync, `refetch`; stale responses dropped, as in `useInfra()`).
- Returns `{ agent, detail, loading, error, notFound, refetch }`. A 404 here means the agent is gone (`notFound`), never "unsupported": Detail is only reachable from a supported list or from Run detail after the list said supported (ticket 11).

**Acceptance criteria**

- [ ] The list row shows before the detail call returns.
- [ ] 404 sets `notFound`; other errors set `error` and keep the row.
- [ ] Changing `id` drops the old response.

**Tests**: new `__tests__/agents/useAgent.test.tsx` with `agents.json`, `agent-detail.json`, `agent-detail-native.json`, `not_found.json` and `internal_error.json`.

**Depends on**: Ticket 5.

### Ticket 9: Agent detail screen

**Scope**

- Replace the placeholder with `app/agents/[id].tsx` (root `screen-agent-detail`, header title = agent name). Cards:
  - **Runs when**: entry chips.
  - **Model & budget**: kind, coding provider, model, `formatBudget(budgetUsd)`, budget group, overrun from `budgetOverrunPct`.
  - **Connections**: flow name with `agent-detail-flow` (`NavigationRow` to Flow), linked agent names, MCP server names, tool names, secret **names**, skills, session resume.
  - **Prompt**: `promptFirstLine` only, plain `Text`.
  - **Last runs**: up to 5 `RunRow`s from `agentRunStats` (`agent-run-row-<runId>`, tap → `/runs/[id]`), titled with the Runs range ("Last 24 hours"); "No runs in the last 24 hours" when empty.
- States: `agent-detail-loading`, `agent-detail-not-found`, `agent-detail-error` with retry.
- The `agent-detail-runs` button is added in ticket 11.

**Acceptance criteria**

- [ ] Coding and native fixtures both render; empty lists hide their line instead of showing "none".
- [ ] No secret value is ever shown; only names from the contract.
- [ ] Every card and row has an accessibility label and a testID where tests touch it.

**Tests**: new `__tests__/agents/detail.test.tsx` against `agent-detail.json`, `agent-detail-native.json`, `not_found.json`, `internal_error.json`, with `graph.json` for last runs.

**Depends on**: Tickets 4 and 8.

### Ticket 10: Flow screen

**Scope**

- Replace the placeholder with `app/agents/flow/[key].tsx` (root `screen-agent-flow`), reading the flow from the `useAgents()` store by `key`.
  - The tree from `flowTree`, one `Text` line per entry, indented by depth; lines with an `agentId` are `NavigationRow`s to Detail.
  - **Recent runs in this flow**: runs of the flow's agents from the live graph, grouped with `asChains` and `ChainHeading` like the Runs tab.
  - **Not linked, but looks related**: agents with the `related` role, if the contract provides them.
- An unknown key (flow gone after a refresh) shows "This flow no longer exists" and a link back.
- The `agent-flow-open-runs` button is added in ticket 12.

**Acceptance criteria**

- [ ] All three flows in `agents.json` render their tree.
- [ ] Tree lines read their `label`, not the symbols.
- [ ] Recent runs match `flowRunStats` and open Run detail.

**Tests**: new `__tests__/agents/flow.test.tsx` against `agents.json` with `graph-chains.json`.

**Depends on**: Tickets 3, 4 and 6.

### Ticket 11: Agent detail → Runs, and Run detail → agent

**Scope**

- `app/agents/[id].tsx`: `agent-detail-runs` ("Runs by <name>") navigates to `/(tabs)` with `agent` and an incremented `agentNavigation`, the same way as `openAgent` in `app/(tabs)/spend.tsx` (extract a shared helper into `src/runs/agentFilter.ts` if both need it).
- `app/runs/[id].tsx`: `run-detail-agent` (`NavigationRow`, "Agent: <agentName>") to `/agents/[id]`, shown only when the shared agents store (ticket 5) already holds data and the agent is in it; hidden when unsupported or not loaded. Run detail reads the store through a read-only selector (`useAgentsSnapshot()` in `src/agents/useAgents.ts`) and never triggers an agents request itself.

**Acceptance criteria**

- [ ] Detail → Runs selects the agent in the Runs agent menu, even when the Runs tab already had another agent selected.
- [ ] Run detail shows the agent link for a supported server and hides it for a 404.
- [ ] Spend's existing per-agent navigation still works.
- [ ] Opening Run detail makes no agents request.

**Tests**: extend `__tests__/agents/detail.test.tsx`, `__tests__/runs/detail.test.tsx` (with `run-detail.json`, `agents.json` and an inline 404) and `__tests__/spend/screen.test.tsx`.

**Depends on**: Ticket 9.

### Ticket 12: Flow → Runs — filter the Runs tab by several agents

**Scope**

- `src/runs/agentFilter.ts`: add `matchesAgents(run, agentIds: readonly string[] | null)`; keep `matchesAgent` working.
- `app/(tabs)/index.tsx`: accept an `agents` route param (comma-separated ids, each `encodeURIComponent`-safe) next to `agent`. When set, the agent menu label reads "<flow name> (N agents)", and `runs-agents-clear` (`TextButton`) returns to "All agents". The empty text names the flow. A later `agent` param or a menu choice replaces it.
- `app/agents/flow/[key].tsx`: `agent-flow-open-runs` ("Open in Runs") navigates with `agents`, the flow name and an incremented `agentNavigation`.

**Acceptance criteria**

- [ ] Only runs of the flow's agents show; switching to a single agent or "All agents" clears the flow filter.
- [ ] Existing single-agent navigation from Spend and Detail is unchanged.
- [ ] The chip and clear control have labels and testIDs.

**Tests**: extend `__tests__/runs/agentFilter.test.ts` and `__tests__/runs/runs.test.tsx` (with `graph.json` / `graph-chains.json`), and `__tests__/agents/flow.test.tsx`.

**Depends on**: Ticket 10.

### Ticket 13: Accessibility pass

**Scope**

- Review and fix the Agents list, Detail, Flow, the Run detail agent link and the Runs flow chip at `fontScale: 2` and a 320 pt window (mock `useWindowDimensions` as `__tests__/navigation.test.tsx` does).
- Agent row label: "builder, lead, Claude Code, opus, $5 per run, last run succeeded"; flow section label reads the strip without symbols; status dots are not separate elements.
- The tab bar with five tabs at `fontScale: 2` and 320 pt: labels stay readable and buttons keep 44 pt.

**Acceptance criteria**

- [ ] At `fontScale: 2` and 320 pt nothing clips horizontally; rows wrap, chips wrap to a new line.
- [ ] No accessibility label contains `⚡`, `⇢`, `→`, `↺`, `≤` or a dot glyph.
- [ ] Every control has a label, a role where one fits, and a testID.

**Tests**: extend `__tests__/agents/screen.test.tsx`, `detail.test.tsx`, `flow.test.tsx` and `__tests__/navigation.test.tsx` with `agents.json`, `agent-detail.json` and `graph.json`.

**Depends on**: Tickets 7, 9, 10 and 12.

## Risks

- **The server endpoint does not exist.** Nothing in this plan can ship until a wardby release adds it. Ticket 1 is a gate; if the shape differs (no flow `key`, other field names), the plan is re-planned instead of guessing.
- **Telling older servers apart.** Mobile relies on a 404 from `GET /admin/api/agents`. If an older server answers differently (for example a viewer HTML fallback or 405), the tab shows a generic error instead of "needs a newer server". Ticket 1 records the real response.
- **Detail 404 is ambiguous.** On `/agents/{id}`, 404 can mean "unknown agent" or "older server". Only the list decides "unsupported"; Detail treats 404 as "agent no longer exists".
- **Run stats are partial.** The graph covers only the Runs tab's range and at most 500 runs. An agent with no runs in that window shows none, and busy deployments may be truncated. The UI names the window and says "at least" when truncated; it never fetches more runs.
- **Unchecked JSON.** `request()` in `src/api/client.ts` casts responses without runtime checks. The model functions (tickets 2–4) treat missing arrays and unknown kinds as empty or neutral and never throw.
- **Exposure.** `secretNames`, MCP server names and `promptFirstLine` are shown to every admin. The server already chose names only; mobile never logs, caches to disk or sends them anywhere. The agents store lives in memory and is cleared on sign-out.
- **Role colours vs status colours.** Orange and green already mean run states (`statusStyle`). A role bar next to status dots could be read as a status. Mitigation: the role always has a text label, and status dots sit in a separate column.
- **Five tabs.** Labels at the largest type size may crowd the tab bar at 320 pt (`tabBarStyle` height already grows with `fontScale`). Ticket 13 checks it.
- **AGENTS.md rules.** No ticket needs a new dependency, a hardcoded host, a secret, phone-home code, or changes to `.github/`, `ios/` or `android/`. A ticket that seems to need any of these stops and reports instead.

## Open questions

1. **Full system prompt on mobile?** The pane shows it, because MCP `get_agent` returns it. The viewer API is admin-wide, so exposing every agent's prompt to any admin is a policy change. This plan proposes first line only. Should it?
2. **Tab count.** Five tabs (Runs, Agents, Spend, Infra, Settings) fit on iOS. Alternatively, Agents could live under Spend's per-agent rows. This plan proposes a fifth tab, placed second.
3. **Admin vs owner scope.** The viewer API is admin-only, so mobile always sees every agent (the pane's `all: true`). `hidden` should then always be 0. This plan keeps the note, shown only when non-zero, for safety. Should the server drop `hidden` from the viewer response instead?
4. **Role colours.** Map the pane's roles to the app's existing status tones (as proposed), or add dedicated role tokens to `components/ui/theme.ts`? Dedicated tokens would remove the role/status overlap noted under Risks.
5. **Flow key (server).** Does `buildAgentFlows` give each flow a stable key across refreshes? If not, the server prerequisite should add one; mobile should not derive one.
6. **Agent runs outside the window (server).** Should the agents response carry a last-run summary per agent, so Detail can show runs older than the Runs range? That would be a server change; this plan does not assume it.
