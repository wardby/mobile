import type { components } from './schema';

export type RunStep = components['schemas']['run-detail']['steps'][number];
export type RunSteps =
  { kind: 'unsupported' } | { kind: 'steps'; steps: RunStep[]; omitted: number; dropped: number };

// Servers before 0.9 send run detail without step fields, and responses are not
// checked at run time, so read the step fields only through here.
export function stepsOf(run: {
  steps?: unknown;
  stepsOmitted?: unknown;
  stepsDropped?: unknown;
  [field: string]: unknown;
}): RunSteps {
  if (!Array.isArray(run.steps)) return { kind: 'unsupported' };
  return {
    kind: 'steps',
    steps: run.steps as RunStep[],
    omitted: count(run.stepsOmitted),
    dropped: count(run.stepsDropped),
  };
}
function count(value: unknown) {
  return typeof value === 'number' && value >= 0 ? value : 0;
}
