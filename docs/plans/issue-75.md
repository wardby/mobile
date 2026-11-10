# Plan: V6 live run steps — what the agent is doing now (#75)

## Summary

An admin watching a long coding run on the phone should see what the run is doing right now ("✓ Bash: npm test", "Editing app/runs/[id].tsx"). Today `app/runs/[id].tsx` shows status, spend, code, outcomes, sub-runs and the final result, and the Runs tab (`app/(tabs)/index.tsx` with `src/runs/RunRow.tsx`) shows status and cost. Neither shows progress inside a run.

This plan brings run steps to mobile in ten small, ordered tickets:

1. Bump the viewer API contract to `@wardby/cli` 0.9.4.
2. Add a pure step model and the merge-by-`seq` logic.
3. Parse `event: step` in the live store and keep steps in memory.
4. Batch step notifications, and handle background and return.
5. Add a `useRunSteps(id)` hook that merges fetched and live steps.
6. Add step formatting and a `StepRow` component.
7. Add a Steps section to Run detail (loading, none, waiting, live).
8. Show finished-run steps with the omitted/dropped note and "Show more".
9. Show the latest step under each running run on the Runs tab.
10. Accessibility pass: Dynamic Type and 320 pt for every step surface.

### What the plan assumes about the wardby server

Everything below comes from the issue and from the contract the app already vendors. The app talks only to the viewer API it pins in `src/api/sync-contract.cjs` (`CLI_VERSION = '0.6.0'` today). No ticket adds a server endpoint.

- `GET /admin/api/runs/{id}` (already used by `createApiClient().getRun` in `src/api/client.ts`) gains `steps`, `stepsOmitted` and `stepsDropped` in 0.9.x. `steps` holds the run's newest steps, each with `seq`, `at`, `kind` (`tool` | `said`), `tool` (nullable), `summary` and `status` (nullable).
- `GET /admin/api/events` (already opened by `openEventStream` in `src/live/stream.ts`) gains `event: step` with an `id:` line. Its data holds `runId`, `seq`, `stepKind`, `tool`, `summary`, `status` and `at`, and never tool output. The same frame shape announces a new step and a status that arrives later for an existing `seq`.
- `GET /admin/api/graph` does **not** gain steps (the issue lists only run detail and events as changed). So the Runs tab learns a run's latest step only from live events, and shows nothing for it until the first `step` event after the graph loads.
- There is no endpoint to page older steps, and no flag that says steps are turned off. A server with steps off returns `steps: []`, `stepsOmitted: 0`, `stepsDropped: 0`, and sends no `step` events.
- The exact type of `status` (string, exit code or object) is not in the issue. Ticket 1 reads it from the regenerated `src/api/openapi.yml` and writes it down in its PR. Ticket 6 maps it to a glyph and a label in one small function, so only that function depends on it.

If ticket 1 finds the 0.9.4 contract differs from these assumptions, the builder stops and reports it in the PR instead of guessing; the later tickets are then re-planned.

### Fixtures this epic adds or changes

| Fixture                                                | Ticket | Content                                                                                                                                                                                       |
| ------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/api/__fixtures__/run-detail.json` (changed)       | 1      | Gains `steps` (tool steps with success, non-zero exit, failure and pending status, one `said` step, one summary that looks like Markdown with a link), `stepsOmitted: 12`, `stepsDropped: 0`. |
| `src/api/__fixtures__/run-detail-steps-off.json` (new) | 1      | A finished run with `steps: []`, `stepsOmitted: 0`, `stepsDropped: 0`: a server with steps turned off.                                                                                        |
| `__tests__/fixtures/step-events.json` (new)            | 2      | A recorded stream: a step, then that step's status, then a new step (with `id:` lines), plus a duplicate frame.                                                                               |
| `__tests__/fixtures/events-steps-off.json` (new)       | 3      | A recorded stream from a server with steps off: `hello`, `run`, `outcome`, `resync`, no `step` frames.                                                                                        |
| `__tests__/fixtures/step-burst.json` (new)             | 4      | 200 `step` frames for one run in one chunk, to test batching.                                                                                                                                 |
| `src/api/__fixtures__/run-detail-dropped.json` (new)   | 8      | A finished run with 34 steps, `stepsOmitted: 40` and `stepsDropped: 5`.                                                                                                                       |

All tests use these recorded fixtures with the existing fakes in `__tests__/live/fakes.ts` (`fakeStream`, `flush`); none talks to a live server.

## Why a plan

The epic touches four layers at once: the generated API contract, the shared live event store (`createLiveGraph` in `src/live/useLiveGraph.ts`, which every screen depends on), the Run detail screen and the Runs list row. A single change would be too large to review and would mix a generated-file bump with state logic and UI. The live store also has subtle ordering rules (open the stream, load the graph, then replay buffered events; refetch on `resync` and reconnect), and step merging adds another: a status can arrive after its step, a resync can lose events, and a refetched run detail can overlap with steps already held in memory. Splitting the work lets each rule be tested on its own against recorded fixtures before any UI depends on it.

Nothing in this plan needs a new dependency, a server host, analytics, secrets, or edits to `.github/`, `ios/` or `android/`.

### Decisions made here

- **Newest first in Run detail.** The question on a running run is "what is it doing now", so the current step is the first row under the STEPS heading and needs no scrolling. The server already returns the newest steps and omits the oldest, so the "N earlier steps not shown" note sits naturally at the bottom, where the older steps would be. New steps insert at the top of the section; rows are keyed by `seq`, so existing rows never reorder.
- **Runs row: the step replaces the details line while running.** `RunRow` is already two lines in a fixed `h-16` (`rowHeight = 64`). A third line does not fit 64 pt at large Dynamic Type sizes. For a running run with a known latest step, the second line shows the step instead of "started · cost"; the full details stay in the row's accessibility label and come back when the run finishes. This is listed as an open question in case the owner prefers cost on the row.
- **Also inside PR chain groups (#68).** Grouped runs render through the same `RunRow` in `app/(tabs)/index.tsx`, so they get the step line for free and consistently. `ChainHeading` itself does not change.
- **Steps live in a separate store from the graph.** Step events must not replace the `graph` object (every `useLiveGraph()` consumer would re-render on every step). Steps get their own store with per-run subscriptions and batched notifications.
- **Steps survive a resync.** On `resync` or reconnect, steps held in memory are kept, not cleared; the refetched run detail is merged in by `seq`, which restores anything missed. Memory for runs no longer in the graph is pruned after each graph load.

## Tickets

Every ticket keeps the AGENTS.md definition of done: `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm test` pass; `npm run export -- --platform web` runs last and succeeds; every new hook and screen has tests; network code is tested against recorded fixtures only; the PR says `Resolves #<ticket issue>`, copies the ticket's acceptance checklist ticked, and has a short "How to try it" section. No ticket edits `.github/`, `ios/` or `android/`, hardcodes a host, or sends data anywhere but the user's own wardby server.

### Ticket 1: Bump the viewer API contract to @wardby/cli 0.9.4

**Scope**

- `src/api/sync-contract.cjs`: set `CLI_VERSION` to `'0.9.4'`.
- Run `npm run api:sync` then `npm run api:generate`; commit the regenerated `src/api/openapi.yml` and `src/api/schema.ts` together. Never edit them by hand.
- `src/api/__fixtures__/run-detail.json`: add `steps`, `stepsOmitted` and `stepsDropped` as listed in the fixtures table.
- New `src/api/__fixtures__/run-detail-steps-off.json`.
- `src/api/__tests__/fixtures.test.ts`: extend the typed `run-detail` example with steps, add the steps-off fixture to the `satisfies JsonShape<...>` checks, and add a typed example of the new step event payload against `components['schemas']['viewer-event']` (or whichever schema the 0.9.4 contract names for it).
- Fix anything the new types break (for example the `RunDetail` objects built in `__tests__/runs/detail.test.tsx` and the field copy in `refetchRun` in `src/live/useLiveGraph.ts`). No behaviour change, no UI.
- In the PR, write down the real shape of `status` and of the step event payload from the regenerated contract.

**Acceptance criteria**

- [ ] `CLI_VERSION` is `0.9.4`; `openapi.yml` and `schema.ts` are regenerated, not hand-edited, and committed together.
- [ ] `src/api/__tests__/schema.test.js` (generated schema matches the pinned contract) passes.
- [ ] `run-detail.json` has steps covering success, non-zero exit, failure, pending, a `said` step and a Markdown-looking summary; `stepsOmitted` is 12.
- [ ] `run-detail-steps-off.json` exists and type-checks against `run-detail`.
- [ ] A typed step-event example exists in `fixtures.test.ts`.
- [ ] `refetchRun` still copies only the fields a graph run has (steps must not leak into the graph).
- [ ] `node_modules` and `package-lock.json` are unchanged by `api:sync`.
- [ ] The PR states the `status` type and the step event payload shape.

**Tests**

- `src/api/__tests__/fixtures.test.ts` against `run-detail.json` and `run-detail-steps-off.json`.
- `src/api/__tests__/schema.test.js` (unchanged, must pass).
- Add a case to `__tests__/live/useLiveGraph.test.tsx` ("an outcome event refetches that run and merges it") asserting a graph run has no `steps` key after a refetch with the new `run-detail.json`.

**Depends on**: none. `@wardby/cli` is already allowlisted for the builder; no other dependency.

### Ticket 2: Step model and merge by seq

**Scope**

- New `src/live/steps.ts` (pure, no React, no network):
  - `type Step` derived from the generated `run-detail` step schema.
  - `stepFromEvent(data)`: validates a parsed `event: step` payload (`runId`, `seq`, `stepKind`, `tool`, `summary`, `status`, `at`) and returns `{ runId, step }` or `null` for a malformed frame. Maps `stepKind` to the detail field `kind`.
  - `mergeSteps(existing, incoming)`: upsert by `seq`. Result is sorted by `seq` ascending, has no duplicate `seq`, and never moves an existing step. When both copies exist, a non-null `status` wins over `null` (a late status is never lost and never undone by an older copy); other fields come from the newer copy.
  - `capSteps(steps, max)` keeps the newest `max` (`maxLiveSteps = 100`).
- New fixture `__tests__/fixtures/step-events.json`.

**Acceptance criteria**

- [ ] A step followed by its status yields one step with that status, in the same position.
- [ ] A status for a `seq` not seen yet inserts the full step (the event carries all fields).
- [ ] Merging the same frame twice changes nothing.
- [ ] Out-of-order `seq` values end up sorted; existing order is never changed.
- [ ] Merging a fetched list that still has `status: null` does not erase a live status.
- [ ] Malformed payloads return `null` and never throw.
- [ ] `capSteps` keeps the newest 100.

**Tests**

- New `__tests__/live/steps.test.ts`: parse `step-events.json` with `SseParser` from `src/live/sse.ts`, feed frames to `stepFromEvent` and `mergeSteps`, and check order, dedupe and late status. Merge with the `steps` from `run-detail.json` to check overlap.

**Depends on**: Ticket 1.

### Ticket 3: Keep live steps in memory from `event: step`

**Scope**

- `src/live/useLiveGraph.ts`, inside `createLiveGraph`:
  - In `handle(frame)`, add a `frame.event === 'step'` branch. It parses with `stepFromEvent` and merges into a new in-memory `Map<runId, Step[]>` (capped with `capSteps`). Step frames are **not** pushed to `buffered` and never call `replaceRun`, `refresh` or `update`, so the `graph` object and `lastUpdated` do not change on a step.
  - Step frames for a run not in the graph are kept too (the run may appear on the next graph load), but they never trigger a graph refresh.
  - After every successful graph load in `refresh()`, prune entries for run ids no longer in `graph.runs`.
  - On `resync`, on reconnect and in `disconnect()`, keep the map (steps survive a resync; ticket 5 refills gaps from run detail). `close()` (sign-out, unmount) clears it.
  - Expose `getSteps(runId)` and `subscribeSteps(runId, listener)` on the returned store, with listeners keyed by run id. In this ticket listeners fire synchronously per frame; ticket 4 batches them.
- `src/live/sse.ts` and `src/live/stream.ts` need no change: `SseParser` already yields any `event:` name with its `id:` and data. Add a parser test to prove it for `step`.
- New fixture `__tests__/fixtures/events-steps-off.json`.

**Acceptance criteria**

- [ ] `event: step` frames update the step map for that run and nothing else; `useLiveGraph().graph` keeps the same object identity.
- [ ] A `step` event never causes a `getGraph` call.
- [ ] After `resync` and after a reconnect, steps already held for a run are still returned by `getSteps`.
- [ ] After a graph load, steps for runs missing from the graph are dropped.
- [ ] Sign-out and unmount clear all steps.
- [ ] The steps-off stream leaves the map empty and causes no error or status change.
- [ ] The open-stream-then-load-graph order and the refetch on `resync`/reconnect are unchanged (existing tests pass untouched).

**Tests**

- `__tests__/live/sse.test.ts`: `step-events.json` split at arbitrary chunk boundaries yields `step` frames with their `id:`.
- `__tests__/live/useLiveGraph.test.tsx`: new cases using `fakeStream` with `step-events.json` (step, status, new step), `events-steps-off.json`, a `resync` mid-sequence, a dropped stream (`latest().end()`), and sign-out.

**Depends on**: Ticket 2.

### Ticket 4: Batch step updates; background and return

**Scope**

- `src/live/useLiveGraph.ts`:
  - Batch step notifications: merges happen immediately in memory, but listeners for a run are notified at most once per `stepFlushMs` (default 500 ms, injectable through `LiveGraphOptions` for tests). One timer covers all runs; it notifies only runs that changed since the last flush.
  - `disconnect()` (called on background) flushes pending changes and clears the timer, so nothing runs while the app is in the background. The existing AppState handler already closes the stream on `background` and reconnects on `active`.
  - Add `loadVersion` to `LiveGraphState`: incremented after every successful graph load that follows a (re)connect, including the return to the foreground. It tells screens that events may have been missed while disconnected, the same way `resyncVersion` does for `resync`. It is not bumped by `setRange` or by refreshes for unknown runs.
- New fixture `__tests__/fixtures/step-burst.json`.

**Acceptance criteria**

- [ ] 200 step frames for one run in one chunk cause one listener call per flush window, and the final steps are correct.
- [ ] Listeners for other runs are not called.
- [ ] Going to the background flushes, clears the timer and leaves no pending timers (`jest.getTimerCount()`); steps stay in memory.
- [ ] Returning to `active` reconnects, reloads the graph and increments `loadVersion` once.
- [ ] A drop and reconnect also increments `loadVersion` once the graph reloads.

**Tests**

- `__tests__/live/useLiveGraph.test.tsx` with fake timers: `step-burst.json`; the existing "background closes the stream and foreground reopens it and refetches" case extended for steps and `loadVersion`; a reconnect case.

**Depends on**: Ticket 3.

### Ticket 5: `useRunSteps(id)` — fetched plus live steps for one run

**Scope**

- New `src/live/useRunSteps.ts` (hook): subscribes with `useSyncExternalStore` to `subscribeSteps(id)`/`getSteps(id)` from the `LiveGraphProvider` store (add a small accessor next to `useLiveGraph` in `src/live/useLiveGraph.ts`, since the store is not exported today). Also `useLatestStep(id)`, returning only the newest step, for the Runs row.
- `useRunSteps(id, detail)` takes the run from `useRunDetail` and returns `{ state, steps, omitted, dropped }`:
  - `steps`: `mergeSteps(detail.steps, live)`, newest first for display.
  - `state`: `'loading'` (no detail yet), `'none'` (finished, no steps, nothing omitted or dropped: steps off or none recorded), `'waiting'` (running, no steps yet), `'live'` (running with steps), `'finished'` (finished with steps).
- `src/runs/useRunDetail.ts`: also refetch when `loadVersion` changes and the run is running (today it refetches on `resyncVersion` and on outcome changes). This is how missed steps come back after a reconnect or a return from the background.

**Acceptance criteria**

- [ ] Steps from run detail and from events are merged with no duplicates and no reordering, including a status that arrives after a refetch.
- [ ] Each of the five states is reached from fixtures.
- [ ] A `step` event for another run does not re-render the hook.
- [ ] `useRunDetail` refetches on a `loadVersion` change only while the run is running.
- [ ] `useLatestStep` returns a stable value when unrelated runs change.

**Tests**

- New `__tests__/live/useRunSteps.test.tsx` with `renderHook`, `run-detail.json`, `run-detail-steps-off.json`, and `step-events.json` pushed through `fakeStream`.
- `__tests__/runs/detail.test.tsx`: a `loadVersion` change refetches a running run and not a finished one.

**Depends on**: Ticket 4.

### Ticket 6: Step formatting and the `StepRow` component

**Scope**

- New `src/runs/steps.ts` (pure): `stepStatus(step)` returns `{ glyph, label, tone }`:
  - success → `✓`, "succeeded", success tone from `statusStyle()`;
  - non-zero exit → `exit 1`, "exited with code 1", failure tone;
  - failure → `✕`, "failed", failure tone;
  - `null` status on a tool step → `…`, "in progress", muted;
  - `said` step → no glyph, label "Agent said".
    The mapping follows the `status` type recorded in ticket 1. `stepText(step)` returns `"Bash: npm test"` (tool, colon, summary) or the summary alone when `tool` is null. `stepLabel(step)` returns the full spoken label, for example "Bash: npm test, succeeded" or "Agent said: Running the tests now".
- New `src/runs/StepRow.tsx`: a non-interactive row (`Box` from `components/ui/box`, `Text` from `components/ui/text`), `testID="run-step-<seq>"`, `accessible`, `accessibilityLabel={stepLabel(step)}`. The glyph sits in a fixed-width column and is hidden from screen readers; the text column is `flex-1 min-w-0`. Tool steps use the regular text colour; `said` steps use italic muted text with a leading quote bar. Colours come from `useColors()`/`statusStyle()` only.
- The summary renders as plain `Text`: never `MarkdownResult`, never a link, never `ExternalLink`. It is a row, not a control, so it has no accent colour and no `›`.
- `numberOfLines` prop (default 2) with tail truncation.

Row variants:

```
 ✓     Bash: npm test
 exit 1 Bash: npm run lint
 ✕     Edit: app/runs/[id].tsx
 …     Read: src/live/stream.ts
 ┃ "I'll run the tests next."        (said: italic, muted)
 ✓     Bash: **bold** [link](x)      (shown literally)
```

**Acceptance criteria**

- [ ] Every status maps to a glyph and a label with no raw symbol in the label.
- [ ] `said` steps look different from tool steps and are read as "Agent said: …".
- [ ] A summary with Markdown and a URL renders literally, with no link role and no press handler.
- [ ] The row has a `testID` and an accessibility label; the glyph is not read separately.
- [ ] No ad-hoc `StyleSheet` colours; no accent colour.

**Tests**

- New `__tests__/runs/steps.test.ts` for `stepStatus`, `stepText`, `stepLabel` over every step in `run-detail.json`.
- New `__tests__/runs/StepRow.test.tsx`: renders each fixture step, checks labels, the plain-text Markdown summary and `numberOfLines`.

**Depends on**: Ticket 1 (types and fixtures). Can be built in parallel with tickets 2–5.

### Ticket 7: Run detail — STEPS section, live

**Scope**

- `app/runs/[id].tsx`: add a `section('STEPS', 'run-detail-steps', …)` between SPEND and OUTCOMES (after SPEND and before the CODE section, so the order is SPEND, STEPS, CODE, OUTCOMES), fed by `useRunSteps(id, run)`. Newest first, one `StepRow` per step keyed by `seq`, showing at most 20 rows in this ticket.
- States, each with its own `testID`:
  - `run-detail-steps-loading`: run detail is (re)loading and there are no steps to show: `Spinner` plus "Loading steps…".
  - `run-detail-steps-none`: finished run, no steps: "No steps recorded for this run." This is also the steps-off state; it is neutral text, not an error.
  - `run-detail-steps-waiting`: running, no steps yet: "Waiting for the first step…".
  - `run-detail-steps-live`: running with steps; rows update as events arrive (batched by ticket 4).
- The section heading keeps `accessibilityRole="header"`.

How the user gets here: Runs tab → tap a run row (`run-row-<id>`) → Run detail.

```
Runs tab                    Run detail (running, live)
┌────────────────────────┐  ┌────────────────────────────┐
│ Builder     [Running]  │  │ ‹ Runs     Builder    ● Live│
│ ✓ Bash: npm test     › │─▶│ [Running]                  │
├────────────────────────┤  │ Started 7m ago · Running 7m│
│ Planner     [Done]     │  │ SPEND                      │
│ 2h ago · $0.12 of $5 › │  │ $0.42 of $5.00  ▓▓░░░░░░   │
└────────────────────────┘  │ STEPS                      │
                            │ …  Read: src/live/stream.ts│
                            │ ✓  Bash: npm test          │
                            │ ┃ "Running the tests now." │
                            │ CODE                       │
                            │ OUTCOMES                   │
                            └────────────────────────────┘

Loading                     Running, no steps yet
┌────────────────────────┐  ┌────────────────────────────┐
│ SPEND  …               │  │ SPEND  …                   │
│ STEPS                  │  │ STEPS                      │
│ (spinner) Loading      │  │ Waiting for the first step…│
│ steps…                 │  │ OUTCOMES                   │
│ OUTCOMES               │  └────────────────────────────┘
└────────────────────────┘

No steps recorded (finished; also steps off on the server)
┌────────────────────────────┐
│ SPEND  …                   │
│ STEPS                      │
│ No steps recorded for this │
│ run.                       │
│ OUTCOMES                   │
└────────────────────────────┘
```

The whole-screen loading, not-found and error states of Run detail are unchanged.

**Acceptance criteria**

- [ ] STEPS sits between SPEND and OUTCOMES.
- [ ] Steps are newest first and keyed by `seq`; a late status updates a row in place.
- [ ] Each of loading, none (steps off), waiting and live is rendered from fixtures with its `testID`.
- [ ] Steps-off shows neutral text, no error, no retry.
- [ ] A step event for the open run updates the section; one for another run does not re-render it.
- [ ] Summaries render as plain text.

**Tests**

- `__tests__/runs/detail.test.tsx`: states from `run-detail.json` (running variant), `run-detail-steps-off.json`, a running run with `steps: []`, and live updates from `step-events.json` through the mocked live store; section order by `testID`.

**Depends on**: Tickets 5 and 6.

### Ticket 8: Run detail — finished runs, omitted/dropped note and "Show more"

**Scope**

- `app/runs/[id].tsx` STEPS section:
  - `run-detail-steps-finished` state: the fetched steps, newest first, with no live updates once `finishedAt` is set.
  - Below the rows, `run-detail-steps-omitted`: "12 earlier steps not shown" when `stepsOmitted > 0`, and `run-detail-steps-dropped`: "5 steps over the server's limit were not recorded" when `stepsDropped > 0`. Muted, plain text, not controls.
  - When there are more than 20 steps, a `TextButton` with `expanded` ("Show all 34 steps" / "Show fewer", `testID="run-detail-steps-more"`) reveals the rest. It only shows steps already loaded; it never fetches older ones (there is no endpoint).
- New fixture `src/api/__fixtures__/run-detail-dropped.json`.

How the user gets here: Runs tab → tap a finished run → Run detail.

```
Finished, with notes                 Finished, more than 20 steps
┌────────────────────────────┐       ┌────────────────────────────┐
│ ‹ Runs     Builder         │       │ STEPS                      │
│ [Succeeded]                │       │ ✓  Bash: gh pr create      │
│ SPEND  $0.84 of $5.00      │       │ ✓  Bash: npm test          │
│ STEPS                      │       │ … (20 rows)                │
│ ✓  Bash: gh pr create      │       │ Show all 34 steps ▾        │
│ ✓  Bash: npm test          │       │ 40 earlier steps not shown │
│ exit 1  Bash: npm run lint │       │ 5 steps over the server's  │
│ ┃ "Fixing the lint error." │       │ limit were not recorded    │
│ 12 earlier steps not shown │       └────────────────────────────┘
│ OUTCOMES                   │
│ PR #81 · open ↗            │       Expanded: all 34 rows, then
└────────────────────────────┘       "Show fewer ▴" and the notes.
```

**Acceptance criteria**

- [ ] A finished run shows its fetched steps and does not change on later step events.
- [ ] The omitted note appears only when `stepsOmitted > 0`; the dropped note only when `stepsDropped > 0`; both use correct singular/plural.
- [ ] "Show all" is a `TextButton` with `expanded`, an accessible label and a `testID`, and does no network call.
- [ ] `run-detail-steps-off.json` still shows the "No steps recorded" state and no notes.

**Tests**

- `__tests__/runs/detail.test.tsx` with `run-detail.json` (omitted 12), `run-detail-dropped.json` (omitted 40, dropped 5), and `run-detail-steps-off.json`; expand and collapse; no extra `getRun` call on expand.

**Depends on**: Ticket 7.

### Ticket 9: Runs tab — latest step under each running run

**Scope**

- `src/runs/RunRow.tsx`: new optional `latestStep` prop. When the run is `running` and `latestStep` is set, the second line shows `StepRow`'s glyph and `stepText` in one line (`numberOfLines={1}`, tail truncation) in place of "started · cost". The row stays `h-16` (`rowHeight = 64`). The accessibility label keeps started and cost and adds ", now: Bash: npm test, succeeded". Finished runs and running runs with no step yet are unchanged.
- Wrap `RunRow` in `React.memo` so a row re-renders only when its own props change.
- New small `LatestStepRunRow` (in `src/runs/RunRow.tsx`) that calls `useLatestStep(run.id)` and renders `RunRow`, used by the `row()` helper in `app/(tabs)/index.tsx` for both single rows and rows inside PR chain groups (#68). `ChainHeading` is unchanged.
- No layout animation; only the text changes, at most once per flush window (ticket 4), so the row does not flicker.

How the user gets here: sign in → Runs tab (the default tab).

```
Loading (unchanged)          Empty (unchanged)
┌────────────────────────┐   ┌──────────────────────────┐
│ (spinner) Loading runs…│   │ No runs in the last 24   │
└────────────────────────┘   │ hours.  Show last 7 days │
                             └──────────────────────────┘
Loaded: running, no step yet / with a step / finished
┌──────────────────────────────────┐
│ Builder              [Running]   │
│ 3m ago · $0.20 of $5.00        › │  ← no step event yet
├──────────────────────────────────┤
│ Builder              [Running]   │
│ ✓ Bash: npm test -- --watch=f… › │  ← latest step, 1 line
├──────────────────────────────────┤
│ Planner              [Done]      │
│ 2h ago · $0.12 of $5.00        › │
└──────────────────────────────────┘
Inside a PR chain group (#68)
┌──────────────────────────────────┐
│ wardby-mobile#64      [Running]  │
│ 3 runs · $1.84                   │
│ ┃ Builder            [Running]   │
│ ┃ … Edit: app/runs/[id].tsx    › │
│ ┃ Reviewer           [Done]      │
│ ┃ 1h ago · $0.30 of $2.00      › │
└──────────────────────────────────┘
Error / offline: the existing LiveIndicator shows the state;
rows keep the last step they had.
```

**Acceptance criteria**

- [ ] A running run with a step shows one truncated step line; others are unchanged.
- [ ] The row height stays 64 pt (`h-16`) with a long summary.
- [ ] Rows inside PR chain groups show the step too; `ChainHeading` is unchanged.
- [ ] A burst of step events for one run re-renders only that row, once per flush window.
- [ ] The accessibility label contains started, cost and the step label, with no raw symbols.
- [ ] When the run finishes, the row goes back to "started · cost".

**Tests**

- `__tests__/runs/runs.test.tsx` with `graph.json` and `graph-chains.json`, steps pushed from `step-events.json` and `step-burst.json` through the live store; a render counter for memoisation; `h-16` and `numberOfLines={1}` asserted.

**Depends on**: Tickets 5 and 6.

### Ticket 10: Accessibility — Dynamic Type and 320 pt for step surfaces

**Scope**

- Review and fix `StepRow`, the STEPS section in `app/runs/[id].tsx` and the step line in `RunRow` at `fontScale: 2` and a 320 pt window width (mock `useWindowDimensions` as `__tests__/navigation.test.tsx` does).
- Run detail rows: the glyph column has a fixed minimum width that fits "exit 127"; the text column is `flex-1 min-w-0` and wraps to at most 2 lines with tail truncation, so nothing clips horizontally.
- Runs row: the step line stays one line and truncates; the row stays 64 pt (a larger type size truncates, it never grows the row or overlaps the badge).
- Labels: every step row reads a full sentence ("Bash: npm test, succeeded"); notes and "Show all" have labels; no label contains `✓`, `✕`, `…` or `┃`.

Run detail at 320 pt, largest text:

```
┌──────────────────────────┐
│ STEPS                    │
│ exit 1  Bash: npm run    │
│         lint -- --max-w… │
│ ✓       Bash: npm test   │
│ 12 earlier steps not     │
│ shown                    │
└──────────────────────────┘
Runs row at 320 pt, largest text:
┌──────────────────────────┐
│ Builder     [Running]    │
│ ✓ Bash: npm test --…   › │
└──────────────────────────┘
```

**Acceptance criteria**

- [ ] At `fontScale: 2` and 320 pt, step rows wrap to at most 2 lines and the glyph column never shrinks below its minimum.
- [ ] The Runs row step line has `numberOfLines={1}` and the row keeps `h-16`.
- [ ] No accessibility label contains a raw symbol; every row and control has a label and a `testID`.
- [ ] The "Show all" control keeps the shared 44×44 minimum target.

**Tests**

- `__tests__/runs/StepRow.test.tsx`, `__tests__/runs/detail.test.tsx` and `__tests__/runs/runs.test.tsx`: cases at `fontScale: 2` and width 320 using `run-detail.json`, `run-detail-dropped.json` and `step-events.json`; a check that no label in the STEPS section or on a running row matches `/[✓✕…┃]/`.

**Depends on**: Tickets 8 and 9.

## Risks

- **Re-render cost on busy runs.** A run can send many step events. Mitigation: steps are kept out of the `graph` object (ticket 3), listeners are per run and batched to at most one notification per 500 ms (ticket 4), `RunRow` is memoised and reads only its own latest step (ticket 9), and Run detail renders at most 20 rows until expanded (ticket 8).
- **Battery in the background.** The stream already closes on `background` in `createLiveGraph`; ticket 4 also clears the flush timer, so no step work runs while backgrounded. On `active`, the existing reconnect reloads the graph and `loadVersion` makes an open Run detail refetch. Steps missed while away come back from run detail; the Runs rows show the next live step only.
- **Gaps after resync or reconnect.** There is no replay. Kept steps plus a refetched run detail, merged by `seq`, fill the gap for the open run. For Runs rows, the latest step can be stale until the next step event. Acceptable for a one-line hint.
- **Runs rows start empty.** The graph has no steps, so after launch a running row shows "started · cost" until its next step event. Fetching run detail per running row would cost one request per row and is not planned.
- **Steps off and "no steps yet" look alike.** With no server flag, a running run on a steps-off server shows "Waiting for the first step…" for its whole life. The text is neutral so it is not misleading as an error.
- **Contract surprises.** If the 0.9.4 contract differs from the issue (status type, event name or fields), ticket 1 records it and stops. Only `src/live/steps.ts` and `src/runs/steps.ts` hold the mapping.
- **Server text.** Summaries are server text (redacted when recorded). They are only ever rendered as plain `Text` (tickets 6, 9); no step text goes through `MarkdownResult` or a link. Steps are never logged or sent anywhere.
- **Memory.** At most 100 steps per run, only for runs still in the graph; cleared on sign-out.
- **Hiding cost on running rows.** Ticket 9 swaps "started · cost" for the step on running rows to keep 64 pt. The cost stays in the accessibility label and on Run detail; see Open questions.
- **AGENTS.md rules.** No ticket needs a new dependency, a hardcoded host, a secret, phone-home code, or changes to `.github/`, `ios/` or `android/`. A ticket that seems to need any of these must stop and report instead.

## Open questions

These are possible wardby server changes or product decisions; none is planned here.

1. **Paging older steps (server change).** The viewer API has no endpoint to page through `stepsOmitted` steps. Mobile shows only the "N earlier steps not shown" note. A paged steps endpoint would be a wardby server change.
2. **Tool output and command detail (server change, out of scope).** These are MCP-only for the owner and run starter. Mobile never shows them, and the viewer API does not serve them.
3. **A "steps enabled" flag (server change).** Run detail or `hello` could say whether the server records steps, so mobile could show "Steps are turned off on this server" instead of "Waiting for the first step…".
4. **Latest step in the graph (server change).** A `latestStep` field on graph runs would let the Runs tab show a step right after launch and after a reconnect, without waiting for an event.
5. **Runs row content.** Is it right to replace "started · cost" with the step on running rows (ticket 9), or would the owner rather keep cost and drop the start time?
6. **Display limit.** Are 20 visible rows and a 100-step in-memory cap the right numbers?
7. **Status type.** The exact `status` values (string, exit code or object) are confirmed in ticket 1; if they cannot express "exit status", ticket 6 shows only ✓ / ✕.
