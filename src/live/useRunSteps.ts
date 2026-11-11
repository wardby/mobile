import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import type { components } from '../api/schema';
import { stepsOf } from '../api/stepsOf';
import { useStepStore } from './stepStore';
import { mergeSteps, type Step } from './steps';

type RunDetail = components['schemas']['run-detail'];
export type RunStepsState = 'loading' | 'unsupported' | 'none' | 'waiting' | 'live' | 'finished';

const none: Step[] = [];

// Live steps for one run, oldest first. Only that run's changes re-render.
function useLiveSteps(id: string) {
  const store = useStepStore();
  const subscribe = useCallback(
    (listener: () => void) => (store ? store.subscribeSteps(id, listener) : () => {}),
    [store, id],
  );
  const getSnapshot = useCallback(() => (store ? store.getSteps(id) : none), [store, id]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// The newest live step of a run, for the Runs row; null when there is none.
export function useLatestStep(id: string): Step | null {
  const steps = useLiveSteps(id);
  return steps[steps.length - 1] ?? null;
}

// Fetched plus live steps for one run, newest first. Steps missed while
// disconnected come back when useRunDetail refetches on loadVersion: that only
// signals "events may have been missed" (refetch to fill the gap), not that
// data changed; the refetched steps merge in by seq.
// `fetched` is the run detail as the server last sent it (`detail` may carry
// live graph fields). Once a fetch returns `finishedAt`, the live steps held at
// that moment are kept and later step events for the run are ignored.
export function useRunSteps(
  id: string,
  detail: RunDetail | null,
  fetchedDetail: RunDetail | null = detail,
) {
  const current = useLiveSteps(id);
  const finishedFetch = fetchedDetail?.finishedAt ? fetchedDetail : null;
  const [frozen, setFrozen] = useState<{ detail: RunDetail; live: Step[] } | null>(null);
  if (finishedFetch && frozen?.detail !== finishedFetch)
    setFrozen({ detail: finishedFetch, live: current });
  const live = finishedFetch && frozen?.detail === finishedFetch ? frozen.live : current;
  const fetched = detail ? stepsOf(detail) : null;
  const supported = fetched?.kind === 'steps';
  const fetchedSteps = fetched?.kind === 'steps' ? fetched.steps : none;
  const steps = useMemo(
    () => (supported ? [...mergeSteps(fetchedSteps, live)].reverse() : none),
    [supported, fetchedSteps, live],
  );
  if (!detail || !fetched) return { state: 'loading' as const, steps, omitted: 0, dropped: 0 };
  if (fetched.kind === 'unsupported')
    return { state: 'unsupported' as const, steps, omitted: 0, dropped: 0 };
  const { omitted, dropped } = fetched;
  const active = detail.status === 'pending' || detail.status === 'running';
  let state: RunStepsState;
  if (active) state = steps.length > 0 ? 'live' : 'waiting';
  else if (steps.length === 0 && omitted === 0 && dropped === 0) state = 'none';
  else state = 'finished';
  return { state, steps, omitted, dropped };
}
