# Plan: V6 live run steps — what the agent is doing now (#75)

## Summary

An admin watching a long coding run on the phone should see what the run is doing right now ("✓ Bash: npm test", "Editing app/runs/[id].tsx"). Today `app/runs/[id].tsx` shows status, spend, code, outcomes, sub-runs and the final result, and the Runs tab (`app/(tabs)/index.tsx` with `src/runs/RunRow.tsx`) shows status and cost. Neither shows progress inside a run.

This plan brings run steps to mobile in ten small, ordered tickets:

1. Bump the viewer API contract to `@wardby/cli` 0.9.4, and add `stepsOf(run)` so older servers keep working.
2. Add a pure step model and the merge-by-`seq` logic.
3. Parse `event: step` in the live store and keep steps in memory.
4. Batch step notifications, and handle background and return.
5. Add a `useRunSteps(id)` hook that merges fetched and live steps.
6. Add step formatting and a `StepRow` component.
7. Add a Steps section to Run detail (loading, unsupported, none, waiting, live).
8. Show finished-run steps with the omitted/dropped note and "Show 20 more" paging.
9. Show the latest step under each running run on the Runs tab.
10. Accessibility pass: Dynamic Type and 320 pt for every step surface.

### What the plan assumes about the wardby server

Everything below comes from the issue and from the contract the app already vendors. The app talks only to the viewer API it pins in `src/api/sync-contract.cjs` (`CLI_VERSION = '0.6.0'` today). No ticket adds a server endpoint.

- `GET /admin/api/runs/{id}` (already used by `createApiClient().getRun` in `src/api/client.ts`) gains `steps`, `stepsOmitted` and `stepsDropped` in 0.9.x. `steps` holds the run's newest steps, each with `seq`, `at`, `kind` (`tool` | `said`), `tool` (nullable), `summary` and `status` (nullable).
- `GET /admin/api/events` (already opened by `openEventStream` in `src/live/stream.ts`) gains `event: step` with an `id:` line. Its data holds `runId`, `seq`, `stepKind`, `tool`, `summary`, `status` and `at`, and never tool output. The same frame shape announces a new step and a status that arrives later for an existing `seq`.
- `GET /admin/api/graph` does **not** gain steps (the issue lists only run detail and events as changed). So the Runs tab learns a run's latest step only from live events, and shows nothing for it until the first `step` event after the graph loads.
- There is no endpoint to page older steps, and no flag that says steps are turned off. A 0.9 server with steps off returns `steps: []`, `stepsOmitted: 0`, `stepsDropped: 0`, and sends no `step` events.
- **Older servers (before 0.9) are still supported.** They send run detail with no step fields at all and never send `event: step`. `request()` in `src/api/client.ts` returns the JSON with a type cast and no runtime check, so after the contract bump the generated types claim `steps` is always there while a pre-0.9 server leaves it out. Every read of step fields therefore goes through one helper, `stepsOf(run)` (ticket 1), which reports "this server doesn't provide steps" instead of crashing or pretending the list is empty. `useLiveGraph` already ignores event types it does not know, so the live store and the Runs tab need no special case.
- The exact type of `status` (string, exit code or object) is not in the issue. Ticket 1 reads it from the regenerated `src/api/openapi.yml` and writes it down in its PR. Ticket 6 maps it to a glyph and a label in one small function, so only that function depends on it.

**Ticket 1 is a gate.** If its PR finds that the real 0.9.4 contract differs from these assumptions (field names, the step event name or payload, the `status` type), the builder stops and reports it in the PR instead of guessing, and tickets 2 to 10 are re-planned before any of them is built.

### Fixtures this epic adds or changes

| Fixture                                                | Ticket | Content                                                                                                                                                                                       |
| ------------------------------------------------------ | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/api/__fixtures__/run-detail.json` (changed)       | 1      | Gains `steps` (tool steps with success, non-zero exit, failure and pending status, one `said` step, one summary that looks like Markdown with a link), `stepsOmitted: 12`, `stepsDropped: 0`. |
| `src/api/__fixtures__/run-detail-steps-off.json` (new) | 1      | A finished run with `steps: []`, `stepsOmitted: 0`, `stepsDropped: 0`: a 0.9 server with steps turned off.                                                                                    |
| `src/api/__fixtures__/run-detail-pre-0.9.json` (new)   | 1      | A run detail with no `steps`, `stepsOmitted` or `stepsDropped` keys at all, as a pre-0.9 server sends it (a copy of today's 0.6.0 `run-detail.json`, taken before ticket 1 changes it).       |
| `__tests__/fixtures/step-events.json` (new)            | 2      | A recorded stream: a step, then that step's status, then a new step (with `id:` lines), plus a duplicate frame.                                                                               |
| `__tests__/fixtures/events-steps-off.json` (new)       | 3      | A recorded stream from a server with steps off: `hello`, `run`, `outcome`, `resync`, no `step` frames.                                                                                        |
| `__tests__/fixtures/step-burst.json` (new)             | 4      | 200 `step` frames for one run in one chunk, to test batching.                                                                                                                                 |
| `src/api/__fixtures__/run-detail-dropped.json` (new)   | 8      | A finished run with 34 steps, `stepsOmitted: 40` and `stepsDropped: 5`.                                                                                                                       |
| `src/api/__fixtures__/run-detail-many.json` (new)      | 8      | A finished run with 45 steps, `stepsOmitted: 3`, `stepsDropped: 0`, to test paging 20 at a time (20, 40, then all 45).                                                                        |

All tests use these recorded fixtures with the existing fakes in `__tests__/live/fakes.ts` (`fakeStream`, `flush`, and the `fakeStepStore` helper added in ticket 3); none talks to a live server.

## Why a plan

The epic touches four layers at once: the generated API contract, the shared live event store (`createLiveGraph` in `src/live/useLiveGraph.ts`, which every screen depends on), the Run detail screen and the Runs list row. A single change would be too large to review and would mix a generated-file bump with state logic and UI. The live store also has subtle ordering rules (open the stream, load the graph, then replay buffered events; refetch on `resync` and reconnect), and step merging adds another: a status can arrive after its step, a resync can lose events, and a refetched run detail can overlap with steps already held in memory. The app must also keep working against servers older than 0.9, which the generated types can no longer describe. Splitting the work lets each rule be tested on its own against recorded fixtures before any UI depends on it.

Nothing in this plan needs a new dependency, a server host, analytics, secrets, or edits to `.github/`, `ios/` or `android/`.

### Decisions made here

- **Newest first in Run detail.** The question on a running run is "what is it doing now", so the current step is the first row under the STEPS heading and needs no scrolling. The server already returns the newest steps and omits the oldest, so the "N earlier steps not shown" note sits naturally at the bottom, where the older steps would be. New steps insert at the top of the section; rows are keyed by `seq`, so existing rows never reorder.
- **Section order.** Run detail sections are, everywhere in this plan (scope, acceptance criteria, tests and wireframes): SPEND, STEPS, CODE (only when the run has code), OUTCOMES, then the existing SUB-RUNS, RESULT and ERROR. STEPS sits between SPEND and OUTCOMES, as the issue asks, and before CODE because "what is it doing now" matters more on a running run than the branch.
- **Runs row: the step replaces the details line while running (owner-confirmed).** `RunRow` is already two lines in a fixed `h-16` (`rowHeight = 64`). A third line does not fit 64 pt at large Dynamic Type sizes. For a running run with a known latest step, the second line shows the step instead of "started · cost"; "started · cost" stays in the row's accessibility label and comes back on the row when the run finishes.
- **Also inside PR chain groups (#68).** Grouped runs render through the same `RunRow` in `app/(tabs)/index.tsx`, so they get the step line for free and consistently. `ChainHeading` itself does not change.
- **Steps live in a separate store from the graph.** Step events must not replace the `graph` object (every `useLiveGraph()` consumer would re-render on every step). Steps get their own store, `createStepStore()` in a new `src/live/stepStore.ts`, with per-run subscriptions and batched notifications. `createLiveGraph` takes it as an optional `steps` entry in `LiveGraphOptions` (building its own when absent) and feeds `event: step` frames into it.
- **How tests provide the step store.** `src/live/stepStore.ts` also exports `StepStoreProvider` and the context the step hooks read. `LiveGraphProvider` renders `StepStoreProvider` with the store its `createLiveGraph` uses. Screen tests (`__tests__/runs/detail.test.tsx`, `__tests__/runs/runs.test.tsx`) mock `src/live/useLiveGraph` today, so they wrap the screen in `StepStoreProvider` directly, with a store built by a new `fakeStepStore(frames?)` helper in `__tests__/live/fakes.ts` (a real `createStepStore` with `flushMs: 0`, optionally pre-filled from fixture frames). Because the provider lives in `stepStore.ts`, mocking `useLiveGraph` does not mock it. Live-store tests pass the same kind of store through `LiveGraphOptions.steps`.
- **Steps survive a resync.** On `resync` or reconnect, steps held in memory are kept, not cleared; the refetched run detail is merged in by `seq`, which restores anything missed. Memory for runs no longer in the graph is pruned after each graph load.
- **Display: 20 steps, then page.** Run detail shows the newest 20 steps, and "Show 20 more" reveals the next 20 each time, until all loaded steps are visible and the control becomes "Show fewer" (owner-confirmed). Paging only covers steps already loaded; the in-memory cap stays at 100 steps per run.
- **Older servers.** A pre-0.9 server is a supported state, not an error: Run detail says "Steps aren't available on this server" and the Runs tab behaves exactly as today.

## Tickets

Every ticket keeps the AGENTS.md definition of done: `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm test` pass; `npm run export -- --platform web` runs last and succeeds; every new hook and screen has tests; network code is tested against recorded fixtures only; the PR says `Resolves #<ticket issue>`, copies the ticket's acceptance checklist ticked, and has a short "How to try it" section. No ticket edits `.github/`, `ios/` or `android/`, hardcodes a host, or sends data anywhere but the user's own wardby server.

### Ticket 1: Bump the viewer API contract to @wardby/cli 0.9.4 and add `stepsOf`

**This ticket's PR is a gate.** If the real 0.9.4 contract differs from "What the plan assumes about the wardby server", the builder stops and reports the differences in the PR, and tickets 2 to 10 are re-planned before any of them is built.

**Scope**

- Before anything else, copy today's `src/api/__fixtures__/run-detail.json` (0.6.0 shape, no step fields) to the new `src/api/__fixtures__/run-detail-pre-0.9.json`.
- `src/api/sync-contract.cjs`: set `CLI_VERSION` to `'0.9.4'`.
- Run `npm run api:sync` then `npm run api:generate`; commit the regenerated `src/api/openapi.yml` and `src/api/schema.ts` together. Never edit them by hand; this ticket leaves the generated `schema.ts` exactly as generated.
- `src/api/__fixtures__/run-detail.json`: add `steps`, `stepsOmitted` and `stepsDropped` as listed in the fixtures table.
- New `src/api/__fixtures__/run-detail-steps-off.json`.
- New `src/api/stepsOf.ts` (pure, no network): `stepsOf(run)` takes a run detail as the server sent it and returns either `{ kind: 'unsupported' }` or `{ kind: 'steps', steps, omitted, dropped }`.
  - `unsupported` when `steps` is missing or is not an array: this server doesn't provide steps. It is a distinct result, never an empty list.
  - Otherwise `steps` is the array, and `omitted`/`dropped` are `stepsOmitted`/`stepsDropped` when they are non-negative numbers, else `0`.
  - Its parameter type makes the three step fields optional, so it accepts both the generated `run-detail` type and a pre-0.9 object.
  - Every later ticket reads `steps`, `stepsOmitted` and `stepsDropped` only through `stepsOf`; nothing else touches those fields directly. Reviewers check this with a search: no `.steps`, `.stepsOmitted` or `.stepsDropped` access on a run detail outside `src/api/stepsOf.ts`.
- `src/api/__tests__/fixtures.test.ts`: extend the typed `run-detail` example with steps, add the steps-off fixture to the `satisfies JsonShape<...>` checks, and add a typed example of the new step event payload against `components['schemas']['viewer-event']` (or whichever schema the 0.9.4 contract names for it). The pre-0.9 fixture is deliberately **not** checked against the 0.9.4 type (it lacks the new fields); it is only read through `stepsOf`.
- Fix anything the new types break (for example the `RunDetail` objects built in `__tests__/runs/detail.test.tsx` and the field copy in `refetchRun` in `src/live/useLiveGraph.ts`). No behaviour change, no UI.
- In the PR, write down the real shape of `status` and of the step event payload from the regenerated contract, and whether each matches the plan.

**Acceptance criteria**

- [ ] `CLI_VERSION` is `0.9.4`; `openapi.yml` and `schema.ts` are regenerated, not hand-edited, and committed together.
- [ ] `src/api/__tests__/schema.test.js` (generated schema matches the pinned contract) passes.
- [ ] `run-detail.json` has steps covering success, non-zero exit, failure, pending, a `said` step and a Markdown-looking summary; `stepsOmitted` is 12.
- [ ] `run-detail-steps-off.json` exists and type-checks against `run-detail`.
- [ ] `run-detail-pre-0.9.json` exists, has no `steps`, `stepsOmitted` or `stepsDropped` key, and is listed in the plan's fixtures table.
- [ ] `stepsOf` returns `unsupported` for the pre-0.9 fixture and for `steps: null`, `steps: {}` or `steps: "x"`; it returns `{ kind: 'steps', steps: [], omitted: 0, dropped: 0 }` for the steps-off fixture; it never throws.
- [ ] No code outside `src/api/stepsOf.ts` reads the three step fields.
- [ ] A typed step-event example exists in `fixtures.test.ts`.
- [ ] `refetchRun` still copies only the fields a graph run has (steps must not leak into the graph).
- [ ] `node_modules` and `package-lock.json` are unchanged by `api:sync`.
- [ ] The PR states the `status` type and the step event payload shape, and says whether the contract matches the plan's assumptions (the gate).

**Tests**

- `src/api/__tests__/fixtures.test.ts` against `run-detail.json` and `run-detail-steps-off.json`.
- New `src/api/__tests__/stepsOf.test.ts` against `run-detail.json`, `run-detail-steps-off.json` and `run-detail-pre-0.9.json`, plus inline malformed values.
- `src/api/__tests__/schema.test.js` (unchanged, must pass).
- Add a case to `__tests__/live/useLiveGraph.test.tsx` ("an outcome event refetches that run and merges it") asserting a graph run has no `steps` key after a refetch with the new `run-detail.json`, and another that a refetch with `run-detail-pre-0.9.json` merges as before.

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

- New `__tests__/live/steps.test.ts`: parse `step-events.json` with `SseParser` from `src/live/sse.ts`, feed frames to `stepFromEvent` and `mergeSteps`, and check order, dedupe and late status. Merge with the steps that `stepsOf` returns for `run-detail.json` to check overlap.

**Depends on**: Ticket 1.

### Ticket 3: Keep live steps in memory from `event: step`

**Scope**

- New `src/live/stepStore.ts`:
  - `createStepStore()` holds a `Map<runId, Step[]>` (capped with `capSteps`) and exposes `merge(runId, steps)`, `getSteps(runId)`, `subscribeSteps(runId, listener)` (listeners keyed by run id), `prune(runIds)` and `clear()`. In this ticket listeners fire synchronously on each merge; ticket 4 batches them.
  - `StepStoreProvider` and `useStepStore()` (a React context). This is how every step hook gets the store, in the app and in tests (see "How tests provide the step store" above).
- `src/live/useLiveGraph.ts`:
  - `LiveGraphOptions` gains an optional `steps` (a `createStepStore()` result); `createLiveGraph` uses it or builds its own, and exposes it as `store.steps`.
  - `LiveGraphProvider` wraps its children in `StepStoreProvider` with `store.steps` (or no store when signed out).
  - In `handle(frame)`, add a `frame.event === 'step'` branch. It parses with `stepFromEvent` and calls `steps.merge`. Step frames are **not** pushed to `buffered` and never call `replaceRun`, `refresh` or `update`, so the `graph` object and `lastUpdated` do not change on a step.
  - Step frames for a run not in the graph are kept too (the run may appear on the next graph load), but they never trigger a graph refresh.
  - After every successful graph load in `refresh()`, call `steps.prune` with the run ids in `graph.runs`.
  - On `resync`, on reconnect and in `disconnect()`, keep the steps (they survive a resync; ticket 5 refills gaps from run detail). `close()` (sign-out, unmount) calls `steps.clear()`.
- `__tests__/live/fakes.ts`: add `fakeStepStore(frames?)`, which builds a real `createStepStore` and, if given recorded frames, merges them through `stepFromEvent`.
- `src/live/sse.ts` and `src/live/stream.ts` need no change: `SseParser` already yields any `event:` name with its `id:` and data. Add a parser test to prove it for `step`.
- A pre-0.9 server never sends `step`; the existing handling of unknown event types already ignores anything else, and this ticket does not change it.
- New fixture `__tests__/fixtures/events-steps-off.json`.

**Acceptance criteria**

- [ ] `event: step` frames update the step store for that run and nothing else; `useLiveGraph().graph` keeps the same object identity.
- [ ] A `step` event never causes a `getGraph` call.
- [ ] After `resync` and after a reconnect, steps already held for a run are still returned by `getSteps`.
- [ ] After a graph load, steps for runs missing from the graph are dropped.
- [ ] Sign-out and unmount clear all steps.
- [ ] The steps-off stream leaves the store empty and causes no error or status change.
- [ ] `LiveGraphOptions.steps` is used when given, and `StepStoreProvider` exposes that same store to children of `LiveGraphProvider`.
- [ ] `fakeStepStore` exists in `__tests__/live/fakes.ts` and is used by this ticket's tests.
- [ ] The open-stream-then-load-graph order and the refetch on `resync`/reconnect are unchanged (existing tests pass untouched).

**Tests**

- `__tests__/live/sse.test.ts`: `step-events.json` split at arbitrary chunk boundaries yields `step` frames with their `id:`.
- New `__tests__/live/stepStore.test.ts`: merge, per-run subscribe, prune and clear on a store from `fakeStepStore`, using `step-events.json`.
- `__tests__/live/useLiveGraph.test.tsx`: new cases using `fakeStream` with `step-events.json` (step, status, new step), `events-steps-off.json`, a `resync` mid-sequence, a dropped stream (`latest().end()`), and sign-out; the step store is passed in through `LiveGraphOptions.steps`.

**Depends on**: Ticket 2.

### Ticket 4: Batch step updates; background and return

**Scope**

- `src/live/stepStore.ts`: batch notifications. Merges happen immediately in memory, but listeners for a run are notified at most once per `flushMs` (default 500 ms, a `createStepStore({ flushMs })` option; `fakeStepStore` uses 0). One timer covers all runs; it notifies only runs that changed since the last flush. Add `flush()` and `pause()` (flush, then clear the timer).
- `src/live/useLiveGraph.ts`:
  - `disconnect()` (called on background) calls `steps.pause()`, so nothing runs while the app is in the background. The existing AppState handler already closes the stream on `background` and reconnects on `active`.
  - Add `loadVersion` to `LiveGraphState`: incremented after every successful graph load that follows a reconnect, including the return to the foreground. It tells screens that events may have been missed while disconnected, the same way `resyncVersion` does for `resync`. It is **not** bumped by the first graph load after `start()`, by `setRange`, or by refreshes for unknown runs.
- New fixture `__tests__/fixtures/step-burst.json`.

**Acceptance criteria**

- [ ] 200 step frames for one run in one chunk cause one listener call per flush window, and the final steps are correct.
- [ ] Listeners for other runs are not called.
- [ ] Going to the background flushes, clears the timer and leaves no pending timers (`jest.getTimerCount()`); steps stay in memory.
- [ ] The initial graph load after `start()` leaves `loadVersion` unset (or 0).
- [ ] Returning to `active` reconnects, reloads the graph and increments `loadVersion` once.
- [ ] A drop and reconnect also increments `loadVersion` once the graph reloads.
- [ ] `setRange` does not change `loadVersion`.

**Tests**

- `__tests__/live/stepStore.test.ts` with fake timers and `step-burst.json`: one notification per window, other runs untouched, `pause()` leaves no timers.
- `__tests__/live/useLiveGraph.test.tsx` with fake timers: a new case that the initial load does not bump `loadVersion`; the existing "background closes the stream and foreground reopens it and refetches" case extended for steps and `loadVersion`; a reconnect case; a `setRange` case.

**Depends on**: Ticket 3.

### Ticket 5: `useRunSteps(id)` — fetched plus live steps for one run

**Scope**

- New `src/live/useRunSteps.ts` (hook): reads the store with `useStepStore()` from `src/live/stepStore.ts` and subscribes with `useSyncExternalStore` to `subscribeSteps(id)`/`getSteps(id)`. Also `useLatestStep(id)`, returning only the newest step, for the Runs row. With no store (signed out) both return nothing.
- `useRunSteps(id, detail)` takes the run from `useRunDetail`, reads its steps only through `stepsOf(detail)` (ticket 1), and returns `{ state, steps, omitted, dropped }`:
  - `steps`: `mergeSteps(fetched, live)`, newest first for display.
  - `state`: `'loading'` (no detail yet), `'unsupported'` (`stepsOf` says the server doesn't provide steps; live steps are ignored), `'none'` (finished, no steps, nothing omitted or dropped: steps off or none recorded), `'waiting'` (running, no steps yet), `'live'` (running with steps), `'finished'` (finished with steps).
- `src/runs/useRunDetail.ts`: also refetch when `loadVersion` changes and the run is running (today it refetches on `resyncVersion` and on outcome changes). This is how missed steps come back after a reconnect or a return from the background.

**Acceptance criteria**

- [ ] Steps from run detail and from events are merged with no duplicates and no reordering, including a status that arrives after a refetch.
- [ ] Each of the six states is reached from fixtures; `run-detail-pre-0.9.json` gives `'unsupported'`, not `'none'` or `'waiting'`.
- [ ] The hook reads step fields only through `stepsOf`.
- [ ] A `step` event for another run does not re-render the hook.
- [ ] `useRunDetail` refetches on a `loadVersion` change only while the run is running.
- [ ] `useLatestStep` returns a stable value when unrelated runs change.

**Tests**

- New `__tests__/live/useRunSteps.test.tsx` with `renderHook`, wrapped in `StepStoreProvider` with a store from `fakeStepStore` (`__tests__/live/fakes.ts`); fixtures `run-detail.json`, `run-detail-steps-off.json`, `run-detail-pre-0.9.json`, and `step-events.json` merged into the store.
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

- New `__tests__/runs/steps.test.ts` for `stepStatus`, `stepText`, `stepLabel` over every step `stepsOf` returns for `run-detail.json`.
- New `__tests__/runs/StepRow.test.tsx`: renders each fixture step, checks labels, the plain-text Markdown summary and `numberOfLines`.

**Depends on**: Ticket 1 (types, fixtures and `stepsOf`). Can be built in parallel with tickets 2–5.

### Ticket 7: Run detail — STEPS section, live

**Scope**

- `app/runs/[id].tsx`: add a `section('STEPS', 'run-detail-steps', …)` directly after SPEND and before CODE, so the order is SPEND, STEPS, CODE (when the run has code), OUTCOMES, then the existing SUB-RUNS, RESULT and ERROR. It is fed by `useRunSteps(id, run)`. Newest first, one `StepRow` per step keyed by `seq`, showing at most 20 rows in this ticket.
- States, each with its own `testID`:
  - `run-detail-steps-loading`: run detail is (re)loading and there are no steps to show: `Spinner` plus "Loading steps…".
  - `run-detail-steps-unsupported`: the server is older than 0.9 and sends no step fields (`stepsOf` returned `unsupported`): "Steps aren't available on this server". Neutral muted text, not an error, no retry. Shown for running and finished runs alike.
  - `run-detail-steps-none`: finished run, no steps: "No steps recorded for this run." This is also the steps-off state on a 0.9 server; it is neutral text, not an error.
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
│ steps…                 │  │ CODE                       │
│ CODE                   │  │ OUTCOMES                   │
│ OUTCOMES               │  └────────────────────────────┘
└────────────────────────┘

No steps recorded            Older server (before 0.9)
(finished; also steps off)   (running or finished)
┌────────────────────────┐   ┌────────────────────────────┐
│ SPEND  …               │   │ SPEND  …                   │
│ STEPS                  │   │ STEPS                      │
│ No steps recorded for  │   │ Steps aren't available on  │
│ this run.              │   │ this server                │
│ CODE                   │   │ CODE                       │
│ OUTCOMES               │   │ OUTCOMES                   │
└────────────────────────┘   └────────────────────────────┘
```

CODE appears only when the run has code, as today; when it is absent, OUTCOMES follows STEPS directly. The whole-screen loading, not-found and error states of Run detail are unchanged.

**Acceptance criteria**

- [ ] The section order is SPEND, STEPS, CODE (when present), OUTCOMES, checked by `testID` order.
- [ ] Steps are newest first and keyed by `seq`; a late status updates a row in place.
- [ ] Each of loading, unsupported, none (steps off), waiting and live is rendered from fixtures with its `testID`.
- [ ] Run detail renders with `run-detail-pre-0.9.json` without throwing and shows `run-detail-steps-unsupported` with "Steps aren't available on this server"; the rest of the screen (SPEND, CODE, OUTCOMES) is unchanged.
- [ ] Unsupported and steps-off show neutral text, no error, no retry.
- [ ] A step event for the open run updates the section; one for another run does not re-render it.
- [ ] Summaries render as plain text.

**Tests**

- `__tests__/runs/detail.test.tsx`, with the screen wrapped in `StepStoreProvider` and a store from `fakeStepStore`: states from `run-detail.json` (running variant), `run-detail-steps-off.json`, `run-detail-pre-0.9.json` (running and finished variants), a running run with `steps: []`, and live updates from `step-events.json` merged into the store; section order by `testID`.

**Depends on**: Tickets 5 and 6.

### Ticket 8: Run detail — finished runs, omitted/dropped note and "Show 20 more"

**Scope**

- `app/runs/[id].tsx` STEPS section:
  - `run-detail-steps-finished` state: the fetched steps, newest first.
  - **A run that finishes while its detail is open.** `useRunSteps` (ticket 5) keeps merging live steps into the list until the next run-detail fetch that returns `finishedAt` (the refetch `useRunDetail` already does on the outcome change). This way a late status for the last step, which can arrive just after the run finishes, is not lost. When that fetched detail arrives, the list is frozen as `mergeSteps(fetched, live steps held at that moment)`, and later step events for the run are ignored.
  - Below the rows, `run-detail-steps-omitted`: "12 earlier steps not shown" when `omitted > 0`, and `run-detail-steps-dropped`: "5 steps over the server's limit were not recorded" when `dropped > 0` (both from `stepsOf`). Muted, plain text, not controls.
  - **Paging loaded steps.** The section shows the newest 20 steps first. When more are loaded, a `TextButton` (`testID="run-detail-steps-more"`) reads "Show 20 more" and reveals the next 20 each time it is pressed. Once every loaded step is visible it reads "Show fewer" and goes back to 20. Its accessibility label says how many are shown, for example "Show 20 more steps, 20 of 45 shown". It never fetches anything: paging covers only steps already loaded (the fetched list plus live steps, capped at 100 per run in memory).
  - **The omitted note still shows** after paging to the end: paging cannot reach the `stepsOmitted` steps, because the viewer API has no endpoint for them (Open question 1).
  - A finished run from a pre-0.9 server stays in the `run-detail-steps-unsupported` state from ticket 7, with no notes and no paging control.
- New fixtures `src/api/__fixtures__/run-detail-dropped.json` and `src/api/__fixtures__/run-detail-many.json`.

How the user gets here: Runs tab → tap a finished run → Run detail.

```
Finished, with notes                 Finished, 45 steps: first 20
┌────────────────────────────┐       ┌────────────────────────────┐
│ ‹ Runs     Builder         │       │ SPEND  …                   │
│ [Succeeded]                │       │ STEPS                      │
│ SPEND  $0.84 of $5.00      │       │ ✓  Bash: gh pr create      │
│ STEPS                      │       │ ✓  Bash: npm test          │
│ ✓  Bash: gh pr create      │       │ … (20 rows)                │
│ ✓  Bash: npm test          │       │ Show 20 more ▾             │
│ exit 1  Bash: npm run lint │       │ 3 earlier steps not shown  │
│ ┃ "Fixing the lint error." │       │ CODE                       │
│ 12 earlier steps not shown │       │ OUTCOMES                   │
│ CODE                       │       └────────────────────────────┘
│ OUTCOMES                   │
│ PR #81 · open ↗            │
└────────────────────────────┘

After one press: 40 rows             After two presses: all 45 rows
┌────────────────────────────┐       ┌────────────────────────────┐
│ STEPS                      │       │ STEPS                      │
│ … (40 rows)                │       │ … (45 rows)                │
│ Show 20 more ▾             │       │ Show fewer ▴               │
│ 3 earlier steps not shown  │       │ 3 earlier steps not shown  │
│ CODE                       │       │ CODE                       │
│ OUTCOMES                   │       │ OUTCOMES                   │
└────────────────────────────┘       └────────────────────────────┘

Dropped steps (34 loaded)            Finished while open
┌────────────────────────────┐       ┌────────────────────────────┐
│ STEPS                      │       │ [Succeeded]                │
│ … (20 rows)                │       │ STEPS                      │
│ Show 20 more ▾             │       │ ✓  Bash: gh pr create      │
│ 40 earlier steps not shown │       │    (late ✓ kept, then the  │
│ 5 steps over the server's  │       │    list stops changing)    │
│ limit were not recorded    │       │ ✓  Bash: npm test          │
│ CODE                       │       │ CODE                       │
│ OUTCOMES                   │       │ OUTCOMES                   │
└────────────────────────────┘       └────────────────────────────┘
```

**Acceptance criteria**

- [ ] A finished run shows its fetched steps, newest first.
- [ ] When the open run finishes, live steps (including a late status for the last step) keep merging until the run-detail fetch that returns `finishedAt`; after it, later step events for that run change nothing.
- [ ] The omitted note appears only when `stepsOmitted > 0`, and still appears when every loaded step is visible; the dropped note only when `stepsDropped > 0`; both use correct singular/plural.
- [ ] With 45 loaded steps the control shows 20, then 40, then 45 rows ("Show 20 more", "Show 20 more", "Show fewer"), and "Show fewer" returns to 20.
- [ ] With 20 or fewer loaded steps there is no paging control.
- [ ] The control is a `TextButton` with an accessible label and a `testID`, and pressing it does no network call.
- [ ] The in-memory cap stays at 100 steps per run.
- [ ] `run-detail-steps-off.json` still shows "No steps recorded" and no notes; `run-detail-pre-0.9.json` (finished) still shows the unsupported state, no notes and no control.

**Tests**

- `__tests__/runs/detail.test.tsx` (wrapped in `StepStoreProvider` with `fakeStepStore`) with `run-detail.json` (omitted 12), `run-detail-dropped.json` (omitted 40, dropped 5), `run-detail-many.json` (paging 20/40/45 and back), `run-detail-steps-off.json` and `run-detail-pre-0.9.json`; no extra `getRun` call on any press.
- A "finishes while open" case: render a running variant of `run-detail.json`, finish the run in the mocked graph, merge a late status from `step-events.json` into the store before the refetch resolves (the row updates), resolve the refetch with a finished variant (state becomes `finished`), then merge another step (nothing changes).

**Depends on**: Ticket 7.

### Ticket 9: Runs tab — latest step under each running run

**Scope**

- `src/runs/RunRow.tsx`: new optional `latestStep` prop. When the run is `running` and `latestStep` is set, the second line shows `StepRow`'s glyph and `stepText` in one line (`numberOfLines={1}`, tail truncation) in place of "started · cost". The row stays `h-16` (`rowHeight = 64`). The accessibility label keeps started and cost and adds ", now: Bash: npm test, succeeded". When the run finishes, "started · cost" comes back on the row. Finished runs and running runs with no step yet are unchanged.
- Wrap `RunRow` in `React.memo` so a row re-renders only when its own props change.
- New small `LatestStepRunRow` (in `src/runs/RunRow.tsx`) that calls `useLatestStep(run.id)` (ticket 5, which reads the store through `useStepStore()`) and renders `RunRow`, used by the `row()` helper in `app/(tabs)/index.tsx` for both single rows and rows inside PR chain groups (#68). `ChainHeading` is unchanged.
- No layout animation; only the text changes, at most once per flush window (ticket 4), so the row does not flicker.
- A pre-0.9 server never sends `step` events, so every row keeps "started · cost", exactly as today. `useLiveGraph` already ignores unknown event types; this ticket pins that with a test rather than adding a special case.

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
├──────────────────────────────────┤     (also every running row
│ Builder              [Running]   │      on a pre-0.9 server)
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
- [ ] When no `step` event ever arrives (a pre-0.9 server, or steps off), every row's text and accessibility label are identical to today's.

**Tests**

- `__tests__/runs/runs.test.tsx`, with the tab wrapped in `StepStoreProvider` and a store from `fakeStepStore` (`__tests__/live/fakes.ts`): `graph.json` and `graph-chains.json`, steps merged from `step-events.json` and `step-burst.json`; a render counter for memoisation; `h-16` and `numberOfLines={1}` asserted.
- A "no step events" case: `graph.json` with an empty step store (as from a pre-0.9 server or `events-steps-off.json`); every row's text and label match the current output.

**Depends on**: Tickets 5 and 6.

### Ticket 10: Accessibility — Dynamic Type and 320 pt for step surfaces

**Scope**

- Review and fix `StepRow`, the STEPS section in `app/runs/[id].tsx` and the step line in `RunRow` at `fontScale: 2` and a 320 pt window width (mock `useWindowDimensions` as `__tests__/navigation.test.tsx` does).
- Run detail rows: the glyph column has a fixed minimum width that fits "exit 127"; the text column is `flex-1 min-w-0` and wraps to at most 2 lines with tail truncation, so nothing clips horizontally.
- Runs row: the step line stays one line and truncates; the row stays 64 pt (a larger type size truncates, it never grows the row or overlaps the badge).
- Labels: every step row reads a full sentence ("Bash: npm test, succeeded"); the notes, the unsupported text and the "Show 20 more" / "Show fewer" control have labels; no label contains `✓`, `✕`, `…` or `┃`.

Run detail at 320 pt, largest text:

```
┌──────────────────────────┐
│ STEPS                    │
│ exit 1  Bash: npm run    │
│         lint -- --max-w… │
│ ✓       Bash: npm test   │
│ Show 20 more             │
│ 12 earlier steps not     │
│ shown                    │
└──────────────────────────┘
Older server at 320 pt, largest text:
┌──────────────────────────┐
│ STEPS                    │
│ Steps aren't available   │
│ on this server           │
└──────────────────────────┘
Runs row at 320 pt, largest text:
┌──────────────────────────┐
│ Builder     [Running]    │
│ ✓ Bash: npm test --…   › │
└──────────────────────────┘
```

**Acceptance criteria**

- [ ] At `fontScale: 2` and 320 pt, step rows wrap to at most 2 lines and the glyph column never shrinks below its minimum.
- [ ] The unsupported and none texts wrap without clipping.
- [ ] The Runs row step line has `numberOfLines={1}` and the row keeps `h-16`.
- [ ] No accessibility label contains a raw symbol; every row and control has a label and a `testID`.
- [ ] The paging control keeps the shared 44×44 minimum target.

**Tests**

- `__tests__/runs/StepRow.test.tsx`, `__tests__/runs/detail.test.tsx` and `__tests__/runs/runs.test.tsx` (screens wrapped in `StepStoreProvider` with `fakeStepStore`): cases at `fontScale: 2` and width 320 using `run-detail.json`, `run-detail-dropped.json`, `run-detail-pre-0.9.json` and `step-events.json`; a check that no label in the STEPS section or on a running row matches `/[✓✕…┃]/`.

**Depends on**: Tickets 8 and 9.

## Risks

- **Re-render cost on busy runs.** A run can send many step events. Mitigation: steps are kept out of the `graph` object in their own store (ticket 3), listeners are per run and batched to at most one notification per 500 ms (ticket 4), `RunRow` is memoised and reads only its own latest step (ticket 9), and Run detail renders 20 rows at a time (ticket 8).
- **Battery in the background.** The stream already closes on `background` in `createLiveGraph`; ticket 4 also pauses the step store's flush timer, so no step work runs while backgrounded. On `active`, the existing reconnect reloads the graph and `loadVersion` makes an open Run detail refetch. Steps missed while away come back from run detail; the Runs rows show the next live step only.
- **Gaps after resync or reconnect.** There is no replay. Kept steps plus a refetched run detail, merged by `seq`, fill the gap for the open run. For Runs rows, the latest step can be stale until the next step event. Acceptable for a one-line hint.
- **Runs rows start empty.** The graph has no steps, so after launch a running row shows "started · cost" until its next step event. Fetching run detail per running row would cost one request per row and is not planned.
- **Older servers and unchecked JSON.** `src/api/client.ts` casts responses without a runtime check, and after ticket 1 the generated types say `steps` is always present. A pre-0.9 server would make any direct `run.steps` read crash Run detail while the typecheck stays green. Mitigation: `stepsOf` (ticket 1) is the only reader of the step fields, returns `unsupported` for missing or non-array values, and is tested against `run-detail-pre-0.9.json`; tickets 7 and 9 test the screens against that fixture and an empty step stream.
- **Steps off and "no steps yet" look alike.** With no server flag, a running run on a 0.9 server with steps off shows "Waiting for the first step…" for its whole life. The text is neutral so it is not misleading as an error. (A pre-0.9 server is told apart, because it sends no step fields at all.)
- **Late status at the end of a run.** The last step's status can arrive after the run finishes. Ticket 8 keeps merging until the run-detail fetch after `finishedAt`, then freezes; a status arriving after that fetch is already in the fetched detail.
- **Contract surprises.** If the 0.9.4 contract differs from the issue (status type, event name or fields), ticket 1's PR records it and stops, and tickets 2 to 10 are re-planned before any is built. Only `src/api/stepsOf.ts`, `src/live/steps.ts` and `src/runs/steps.ts` hold the mapping.
- **Server text.** Summaries are server text (redacted when recorded). They are only ever rendered as plain `Text` (tickets 6, 9); no step text goes through `MarkdownResult` or a link. Steps are never logged or sent anywhere.
- **Memory.** At most 100 steps per run, only for runs still in the graph; cleared on sign-out. Paging in ticket 8 never raises this cap.
- **Hiding cost on running rows.** Ticket 9 swaps "started · cost" for the step on running rows to keep 64 pt (owner-confirmed). The cost stays in the accessibility label and on Run detail, and returns on the row when the run finishes.
- **AGENTS.md rules.** No ticket needs a new dependency, a hardcoded host, a secret, phone-home code, or changes to `.github/`, `ios/` or `android/`. A ticket that seems to need any of these must stop and report instead.

## Open questions

These are possible wardby server changes or details only the real contract can settle; none is planned here.

1. **Paging older steps (server change).** The viewer API has no endpoint to page through `stepsOmitted` steps. Mobile pages only through steps it already holds (ticket 8) and shows the "N earlier steps not shown" note. A paged steps endpoint would be a wardby server change.
2. **Tool output and command detail (server change, out of scope).** These are MCP-only for the owner and run starter. Mobile never shows them, and the viewer API does not serve them.
3. **A "steps enabled" flag (server change).** Run detail or `hello` could say whether the server records steps, so mobile could show "Steps are turned off on this server" instead of "Waiting for the first step…".
4. **Latest step in the graph (server change).** A `latestStep` field on graph runs would let the Runs tab show a step right after launch and after a reconnect, without waiting for an event.
5. **Status type.** The exact `status` values (string, exit code or object) are confirmed in ticket 1; if they cannot express "exit status", ticket 6 shows only ✓ / ✕.
