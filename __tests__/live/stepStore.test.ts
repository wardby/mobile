import fixtures from '../fixtures/step-events.json';
import { createStepStore } from '../../src/live/stepStore';
import { maxLiveSteps, type Step } from '../../src/live/steps';
import { fakeStepStore } from './fakes';

function step(seq: number, status: string | null = 'ok'): Step {
  return {
    seq,
    at: '2026-10-01T10:00:00.000Z',
    kind: 'tool',
    tool: 'Bash',
    summary: `step ${seq}`,
    status,
  };
}
const seqs = (steps: Step[]) => steps.map((item) => item.seq);

test('fakeStepStore merges the recorded step events by seq', () => {
  const store = fakeStepStore(fixtures.stream);
  const steps = store.getSteps('run-coding');
  expect(seqs(steps)).toEqual([18, 19]);
  expect(steps[0]?.status).toBe('ok');
  expect(steps[1]).toMatchObject({ kind: 'said', tool: null });
});
test('an unknown run has no steps, and the empty list is stable', () => {
  const store = fakeStepStore();
  expect(store.getSteps('run-coding')).toEqual([]);
  expect(store.getSteps('run-coding')).toBe(store.getSteps('run-other'));
});
test('merge notifies only the listeners of that run', () => {
  const store = createStepStore();
  const coding = jest.fn();
  const other = jest.fn();
  store.subscribeSteps('run-coding', coding);
  store.subscribeSteps('run-other', other);
  store.merge('run-coding', [step(1, null)]);
  store.merge('run-coding', [step(1, 'ok')]);
  expect(coding).toHaveBeenCalledTimes(2);
  expect(other).not.toHaveBeenCalled();
  expect(store.getSteps('run-coding')).toEqual([step(1, 'ok')]);
});
test('a duplicate frame changes nothing and notifies nobody', () => {
  const store = fakeStepStore(fixtures.stream);
  const before = store.getSteps('run-coding');
  const listener = jest.fn();
  store.subscribeSteps('run-coding', listener);
  store.merge('run-coding', [{ ...before[1]! }]);
  expect(store.getSteps('run-coding')).toBe(before);
  expect(listener).not.toHaveBeenCalled();
});
test('unsubscribing stops notifications', () => {
  const store = createStepStore();
  const listener = jest.fn();
  const unsubscribe = store.subscribeSteps('run-coding', listener);
  unsubscribe();
  store.merge('run-coding', [step(1)]);
  expect(listener).not.toHaveBeenCalled();
});
test('keeps the newest 100 steps per run', () => {
  const store = createStepStore();
  store.merge(
    'run-coding',
    Array.from({ length: 150 }, (_, index) => step(index + 1)),
  );
  const steps = store.getSteps('run-coding');
  expect(steps).toHaveLength(maxLiveSteps);
  expect(steps[0]?.seq).toBe(51);
  expect(steps[steps.length - 1]?.seq).toBe(150);
});
test('prune drops runs that are not listed and notifies them', () => {
  const store = fakeStepStore(fixtures.stream);
  store.merge('run-gone', [step(1)]);
  const coding = jest.fn();
  const gone = jest.fn();
  store.subscribeSteps('run-coding', coding);
  store.subscribeSteps('run-gone', gone);
  store.prune(['run-coding', 'run-parent']);
  expect(seqs(store.getSteps('run-coding'))).toEqual([18, 19]);
  expect(store.getSteps('run-gone')).toEqual([]);
  expect(gone).toHaveBeenCalledTimes(1);
  expect(coding).not.toHaveBeenCalled();
});
test('clear drops every run and notifies them', () => {
  const store = fakeStepStore(fixtures.stream);
  store.merge('run-other', [step(1)]);
  const coding = jest.fn();
  store.subscribeSteps('run-coding', coding);
  store.clear();
  expect(store.getSteps('run-coding')).toEqual([]);
  expect(store.getSteps('run-other')).toEqual([]);
  expect(coding).toHaveBeenCalledTimes(1);
});
