import fixture from '../../src/api/__fixtures__/run-detail.json';
import { stepsOf, type RunStep } from '../../src/api/stepsOf';
import { stepLabel, stepStatus, stepText } from '../../src/runs/steps';
import { statusStyle } from '../../src/runs/status';

const loaded = stepsOf(fixture);
const steps = loaded.kind === 'steps' ? loaded.steps : [];
const bySeq = (seq: number) => steps.find((step) => step.seq === seq)!;
const symbols = /[✓✕…┃]/;

test('the fixture has every kind of step', () => {
  expect(steps.map((step) => step.seq)).toEqual([13, 14, 15, 16, 17, 18]);
});

test.each([
  [13, '✓', 'succeeded', statusStyle('succeeded').tone],
  [15, 'exit 1', 'exited with code 1', statusStyle('failed').tone],
  [16, '✕', 'failed', statusStyle('failed').tone],
  [18, '…', 'in progress', 'muted'],
  [14, '', 'Agent said', 'muted'],
])('stepStatus of step %p is %p, %p', (seq, glyph, label, tone) => {
  expect(stepStatus(bySeq(seq))).toEqual({ glyph, label, tone });
});

test('stepStatus reads any exit code', () => {
  const step: RunStep = { ...bySeq(15), status: 'exit 127' };
  expect(stepStatus(step)).toMatchObject({ glyph: 'exit 127', label: 'exited with code 127' });
});

test.each([
  [13, 'Read: src/live/stream.ts'],
  [14, "I'll run the tests next."],
  [15, 'Bash: npm run lint'],
  [16, 'Edit: app/runs/[id].tsx'],
  [17, 'Bash: echo **bold** [link](https://example.test/x)'],
  [18, 'Bash: npm test'],
])('stepText of step %p is %p', (seq, text) => {
  expect(stepText(bySeq(seq))).toBe(text);
});

test.each([
  [13, 'Read: src/live/stream.ts, succeeded'],
  [14, "Agent said: I'll run the tests next."],
  [15, 'Bash: npm run lint, exited with code 1'],
  [16, 'Edit: app/runs/[id].tsx, failed'],
  [17, 'Bash: echo **bold** [link](https://example.test/x), succeeded'],
  [18, 'Bash: npm test, in progress'],
])('stepLabel of step %p is %p', (seq, label) => {
  expect(stepLabel(bySeq(seq))).toBe(label);
});

test('no label contains a raw symbol', () => {
  for (const step of steps) {
    expect(stepLabel(step)).not.toMatch(symbols);
    expect(stepStatus(step).label).not.toMatch(symbols);
  }
});
