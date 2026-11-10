import run from '../__fixtures__/run-detail.json';
import stepsOff from '../__fixtures__/run-detail-steps-off.json';
import pre09 from '../__fixtures__/run-detail-pre-0.9.json';
import { stepsOf } from '../stepsOf';

test('returns the steps and counts from run detail', () => {
  expect(stepsOf(run)).toEqual({
    kind: 'steps',
    steps: run.steps,
    omitted: 12,
    dropped: 0,
  });
});
test('returns an empty list for a server with steps turned off', () => {
  expect(stepsOf(stepsOff)).toEqual({ kind: 'steps', steps: [], omitted: 0, dropped: 0 });
});
test('reports unsupported for a server older than 0.9', () => {
  expect(pre09).not.toHaveProperty('steps');
  expect(pre09).not.toHaveProperty('stepsOmitted');
  expect(pre09).not.toHaveProperty('stepsDropped');
  expect(stepsOf(pre09)).toEqual({ kind: 'unsupported' });
});
it.each([null, {}, 'x', 3, undefined])('reports unsupported when steps is %p', (steps) => {
  expect(stepsOf({ ...pre09, steps })).toEqual({ kind: 'unsupported' });
});
it.each([undefined, null, -1, 'x', Number.NaN, {}])(
  'counts %p omitted or dropped steps as 0',
  (count) => {
    expect(stepsOf({ steps: [], stepsOmitted: count, stepsDropped: count })).toEqual({
      kind: 'steps',
      steps: [],
      omitted: 0,
      dropped: 0,
    });
  },
);
test('keeps non-negative counts', () => {
  expect(stepsOf({ steps: [], stepsOmitted: 3, stepsDropped: 5 })).toMatchObject({
    omitted: 3,
    dropped: 5,
  });
});
