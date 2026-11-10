import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import events from '../fixtures/step-events.json';
import fixture from '../../src/api/__fixtures__/run-detail.json';
import stepsOff from '../../src/api/__fixtures__/run-detail-steps-off.json';
import pre09 from '../../src/api/__fixtures__/run-detail-pre-0.9.json';
import type { components } from '../../src/api/schema';
import { StepStoreProvider, type StepStore } from '../../src/live/stepStore';
import type { Step } from '../../src/live/steps';
import { useLatestStep, useRunSteps } from '../../src/live/useRunSteps';
import { fakeStepStore } from './fakes';

type Detail = components['schemas']['run-detail'];
const running = fixture as Detail;
const finished = {
  ...fixture,
  status: 'succeeded',
  finishedAt: '2026-10-01T10:06:00.000Z',
} as Detail;
const old = pre09 as unknown as Detail;

function step(seq: number, status: string | null = 'ok', runId = 'run-coding') {
  return [
    runId,
    [
      {
        seq,
        at: '2026-10-01T10:07:00.000Z',
        kind: 'tool',
        tool: 'Bash',
        summary: `step ${seq}`,
        status,
      },
    ],
  ] as [string, Step[]];
}
const seqs = (steps: Step[]) => steps.map((item) => item.seq);

async function mount(store: StepStore | null, detail: Detail | null) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StepStoreProvider store={store}>{children}</StepStoreProvider>
  );
  let renders = 0;
  const hook = await renderHook(
    ({ run }: { run: Detail | null }) => {
      renders++;
      return useRunSteps('run-coding', run);
    },
    { wrapper, initialProps: { run: detail } },
  );
  return { ...hook, renders: () => renders };
}

test('no detail yet is loading', async () => {
  const { result } = await mount(fakeStepStore(events.stream), null);
  expect(result.current).toEqual({ state: 'loading', steps: [], omitted: 0, dropped: 0 });
});
test('a pre-0.9 server is unsupported, and live steps are ignored', async () => {
  const { result } = await mount(fakeStepStore(events.stream), old);
  expect(result.current).toEqual({ state: 'unsupported', steps: [], omitted: 0, dropped: 0 });
  const done = await mount(fakeStepStore(), { ...old, status: 'succeeded' } as Detail);
  expect(done.result.current.state).toBe('unsupported');
});
test('a finished run with no steps (steps off) is none', async () => {
  const { result } = await mount(fakeStepStore(), stepsOff as Detail);
  expect(result.current).toEqual({ state: 'none', steps: [], omitted: 0, dropped: 0 });
});
test('a running run with no steps yet is waiting', async () => {
  const { result } = await mount(fakeStepStore(), { ...running, steps: [], stepsOmitted: 0 });
  expect(result.current.state).toBe('waiting');
  expect(result.current.steps).toEqual([]);
});
test('a finished run with steps is finished, newest first, with the notes counts', async () => {
  const { result } = await mount(fakeStepStore(), finished);
  expect(result.current.state).toBe('finished');
  expect(seqs(result.current.steps)).toEqual([18, 17, 16, 15, 14, 13]);
  expect(result.current.omitted).toBe(12);
  expect(result.current.dropped).toBe(0);
});
test('a running run merges fetched and live steps by seq: no duplicates, newest first', async () => {
  const { result } = await mount(fakeStepStore(events.stream), running);
  expect(result.current.state).toBe('live');
  expect(seqs(result.current.steps)).toEqual([19, 18, 17, 16, 15, 14, 13]);
  // The fetched seq 18 had no status; the live status wins.
  expect(result.current.steps[1]?.status).toBe('ok');
});
test('a waiting run goes live when the first step event arrives', async () => {
  const store = fakeStepStore();
  const { result } = await mount(store, { ...running, steps: [], stepsOmitted: 0 });
  expect(result.current.state).toBe('waiting');
  await act(async () => store.merge(...step(1, null)));
  expect(result.current.state).toBe('live');
  expect(seqs(result.current.steps)).toEqual([1]);
});
test('a status that arrives after a refetch updates the step in place', async () => {
  const store = fakeStepStore();
  const { result, rerender } = await mount(store, running);
  await rerender({ run: { ...running } });
  await act(async () => store.merge(...step(18, 'exit 2')));
  expect(seqs(result.current.steps)).toEqual([18, 17, 16, 15, 14, 13]);
  expect(result.current.steps[0]).toMatchObject({ seq: 18, status: 'exit 2', summary: 'step 18' });
  // A later refetch that still has status null does not undo the live status.
  await rerender({ run: { ...running } });
  expect(result.current.steps[0]?.status).toBe('exit 2');
  expect(seqs(result.current.steps)).toEqual([18, 17, 16, 15, 14, 13]);
});
test('a step event for another run does not re-render the hook', async () => {
  const store = fakeStepStore();
  const hook = await mount(store, running);
  const before = hook.renders();
  const steps = hook.result.current.steps;
  await act(async () => store.merge(...step(1, 'ok', 'run-other')));
  expect(hook.renders()).toBe(before);
  expect(hook.result.current.steps).toBe(steps);
});
test('with no store (signed out) only the fetched steps show', async () => {
  const { result } = await mount(null, running);
  expect(result.current.state).toBe('live');
  expect(seqs(result.current.steps)).toEqual([18, 17, 16, 15, 14, 13]);
});

async function mountLatest(store: StepStore | null) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StepStoreProvider store={store}>{children}</StepStoreProvider>
  );
  return renderHook(() => useLatestStep('run-coding'), { wrapper });
}
test('useLatestStep returns the newest live step, stable across unrelated runs', async () => {
  const store = fakeStepStore(events.stream);
  const { result } = await mountLatest(store);
  expect(result.current).toMatchObject({ seq: 19, kind: 'said' });
  const latest = result.current;
  await act(async () => store.merge(...step(1, 'ok', 'run-other')));
  expect(result.current).toBe(latest);
  await act(async () => store.merge(...step(20, null)));
  expect(result.current).toMatchObject({ seq: 20, status: null });
});
test('useLatestStep returns nothing with no steps or no store', async () => {
  expect((await mountLatest(fakeStepStore())).result.current).toBeNull();
  expect((await mountLatest(null)).result.current).toBeNull();
});
