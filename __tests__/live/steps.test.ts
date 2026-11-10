import fixtures from '../fixtures/step-events.json';
import run from '../../src/api/__fixtures__/run-detail.json';
import { stepsOf } from '../../src/api/stepsOf';
import { SseParser } from '../../src/live/sse';
import { capSteps, maxLiveSteps, mergeSteps, stepFromEvent, type Step } from '../../src/live/steps';

function events() {
  return new SseParser()
    .push(fixtures.stream)
    .filter((frame) => frame.event === 'step')
    .map((frame) => stepFromEvent(JSON.parse(frame.data)));
}
function fetched() {
  const steps = stepsOf(run);
  if (steps.kind !== 'steps') throw new Error('run-detail.json has no steps');
  return steps.steps as Step[];
}
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

test('parses the recorded step events', () => {
  const parsed = events();
  expect(parsed).toHaveLength(4);
  expect(parsed[0]).toEqual({
    runId: 'run-coding',
    step: {
      seq: 18,
      at: '2026-10-01T10:05:00.000Z',
      kind: 'tool',
      tool: 'Bash',
      summary: 'npm test',
      status: null,
    },
  });
  expect(parsed[2]?.step).toMatchObject({ seq: 19, kind: 'said', tool: null });
});
test('a step followed by its status yields one step with that status, in place', () => {
  const [first, status] = events();
  const merged = mergeSteps(mergeSteps([step(17)], [first!.step]), [status!.step]);
  expect(seqs(merged)).toEqual([17, 18]);
  expect(merged[1]).toEqual({ ...first!.step, status: 'ok' });
});
test('a status for an unseen seq inserts the full step', () => {
  const [, status] = events();
  expect(mergeSteps([], [status!.step])).toEqual([status!.step]);
});
test('merging the whole stream, duplicate frame included, gives one copy of each step', () => {
  const merged = events().reduce<Step[]>((steps, event) => mergeSteps(steps, [event!.step]), []);
  expect(seqs(merged)).toEqual([18, 19]);
  expect(merged[0]?.status).toBe('ok');
  expect(mergeSteps(merged, [merged[1]!])).toEqual(merged);
  expect(mergeSteps(merged, merged)).toEqual(merged);
});
test('merges live events with fetched steps by seq, with no duplicates', () => {
  const live = events().reduce<Step[]>((steps, event) => mergeSteps(steps, [event!.step]), []);
  const merged = mergeSteps(fetched(), live);
  expect(seqs(merged)).toEqual([13, 14, 15, 16, 17, 18, 19]);
  expect(merged.find((item) => item.seq === 18)?.status).toBe('ok');
  expect(merged.slice(0, 5)).toEqual(fetched().slice(0, 5));
});
test('a fetched list with a null status does not erase a live status', () => {
  const live = events().reduce<Step[]>((steps, event) => mergeSteps(steps, [event!.step]), []);
  const merged = mergeSteps(live, fetched());
  expect(merged.find((item) => item.seq === 18)?.status).toBe('ok');
  expect(seqs(merged)).toEqual([13, 14, 15, 16, 17, 18, 19]);
});
test('a newer status replaces an older one, and other fields come from the newer copy', () => {
  const merged = mergeSteps([step(1, 'exit 1')], [{ ...step(1, 'ok'), summary: 'redacted' }]);
  expect(merged).toEqual([{ ...step(1, 'ok'), summary: 'redacted' }]);
  expect(mergeSteps([step(1, 'ok')], [{ ...step(1, null), summary: 'newer' }])).toEqual([
    { ...step(1, 'ok'), summary: 'newer' },
  ]);
});
test('out-of-order seq values end up sorted without moving existing steps', () => {
  const existing = [step(2), step(5), step(9)];
  const merged = mergeSteps(existing, [step(7), step(1), step(10), step(3)]);
  expect(seqs(merged)).toEqual([1, 2, 3, 5, 7, 9, 10]);
  expect(seqs(merged.filter((item) => existing.includes(item)))).toEqual([2, 5, 9]);
});
test('merging does not change its inputs', () => {
  const existing = [step(1, null)];
  const incoming = [step(1, 'ok')];
  mergeSteps(existing, incoming);
  expect(existing).toEqual([step(1, null)]);
  expect(incoming).toEqual([step(1, 'ok')]);
});
it.each([
  ['null', null],
  ['a string', 'x'],
  ['an array', []],
  ['an empty object', {}],
  ['no runId', { ...validEvent(), runId: undefined }],
  ['an empty runId', { ...validEvent(), runId: '' }],
  ['a string seq', { ...validEvent(), seq: '18' }],
  ['a fractional seq', { ...validEvent(), seq: 1.5 }],
  ['a NaN seq', { ...validEvent(), seq: Number.NaN }],
  ['an unknown stepKind', { ...validEvent(), stepKind: 'thought' }],
  ['a numeric tool', { ...validEvent(), tool: 3 }],
  ['a missing tool', { ...validEvent(), tool: undefined }],
  ['a null summary', { ...validEvent(), summary: null }],
  ['a numeric status', { ...validEvent(), status: 1 }],
  ['a missing status', { ...validEvent(), status: undefined }],
  ['a missing at', { ...validEvent(), at: undefined }],
])('returns null for a payload with %s', (_name, data) => {
  expect(() => stepFromEvent(data)).not.toThrow();
  expect(stepFromEvent(data)).toBeNull();
});
function validEvent(): Record<string, unknown> {
  return JSON.parse(new SseParser().push(fixtures.stream).find((f) => f.event === 'step')!.data);
}
test('keeps only the step fields of a valid payload', () => {
  expect(stepFromEvent({ ...validEvent(), extra: 'x' })?.step).not.toHaveProperty('extra');
});
test('capSteps keeps the newest 100 steps by seq', () => {
  expect(maxLiveSteps).toBe(100);
  // The server sends up to its newest 200 steps, oldest first.
  const server = Array.from({ length: 200 }, (_, index) => step(index + 1));
  const capped = capSteps(server, maxLiveSteps);
  expect(seqs(capped)).toEqual(Array.from({ length: 100 }, (_, index) => index + 101));
  const shuffled = [...server.slice(150), ...server.slice(0, 150)];
  expect(seqs(capSteps(shuffled, maxLiveSteps))).toEqual(seqs(capped));
});
test('capSteps leaves a short list unchanged', () => {
  const steps = [step(1), step(2)];
  expect(capSteps(steps, maxLiveSteps)).toEqual(steps);
  expect(capSteps(fetched(), maxLiveSteps)).toEqual(fetched());
});
test('a duplicate frame keeps the existing step objects and array', () => {
  const merged = events().reduce<Step[]>((steps, event) => mergeSteps(steps, [event!.step]), []);
  expect(mergeSteps(merged, [{ ...merged[1]! }])).toBe(merged);
  expect(
    mergeSteps(
      merged,
      merged.map((item) => ({ ...item })),
    ),
  ).toBe(merged);
  expect(mergeSteps(merged, [])).toBe(merged);
  // A fetched copy with a null status matches a step that already has one.
  expect(mergeSteps(merged, [{ ...merged[0]!, status: null }])).toBe(merged);
});
test('a changed step keeps the unchanged step objects', () => {
  const existing = [step(1), step(2, null), step(3)];
  const merged = mergeSteps(existing, [{ ...step(1) }, step(2, 'ok'), step(4)]);
  expect(merged).not.toBe(existing);
  expect(merged).toEqual([step(1), step(2, 'ok'), step(3), step(4)]);
  expect(merged[0]).toBe(existing[0]);
  expect(merged[1]).not.toBe(existing[1]);
  expect(merged[2]).toBe(existing[2]);
});
