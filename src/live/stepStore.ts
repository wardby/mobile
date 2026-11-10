import { createContext, createElement, useContext, type ReactNode } from 'react';
import { capSteps, maxLiveSteps, mergeSteps, type Step } from './steps';

const none: Step[] = [];

// Live steps per run, kept apart from the graph so a step never replaces the
// graph object. Listeners are keyed by run id. Merges apply at once; listeners
// of a changed run hear about it at most once per `flushMs` (0: right away).
export function createStepStore({ flushMs = 500 }: { flushMs?: number } = {}) {
  const steps = new Map<string, Step[]>();
  const listeners = new Map<string, Set<() => void>>();
  const changed = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const notify = (runId: string) => listeners.get(runId)?.forEach((listener) => listener());
  function flush() {
    if (timer) clearTimeout(timer);
    timer = null;
    const runIds = [...changed];
    changed.clear();
    runIds.forEach(notify);
  }
  // Dropped runs hear about it right away; other pending runs keep their window.
  const drop = (runIds: string[]) => {
    runIds.forEach((runId) => {
      steps.delete(runId);
      changed.delete(runId);
    });
    if (changed.size === 0) flush();
    runIds.forEach(notify);
  };
  return {
    merge(runId: string, incoming: Step[]) {
      const current = steps.get(runId) ?? none;
      const next = capSteps(mergeSteps(current, incoming), maxLiveSteps);
      if (next === current) return;
      steps.set(runId, next);
      changed.add(runId);
      if (flushMs <= 0) flush();
      else timer ??= setTimeout(flush, flushMs);
    },
    flush,
    // Flushes and stops the timer (the app went to the background).
    pause: flush,
    runIds: () => [...steps.keys()],
    getSteps: (runId: string) => steps.get(runId) ?? none,
    subscribeSteps(runId: string, listener: () => void) {
      const set = listeners.get(runId) ?? new Set();
      set.add(listener);
      listeners.set(runId, set);
      return () => {
        set.delete(listener);
        if (set.size === 0 && listeners.get(runId) === set) listeners.delete(runId);
      };
    },
    // Keeps only the listed runs. With `held`, only those runs can be dropped.
    prune(runIds: Iterable<string>, held: Iterable<string> = steps.keys()) {
      const keep = new Set(runIds);
      drop([...held].filter((runId) => steps.has(runId) && !keep.has(runId)));
    },
    clear() {
      drop([...steps.keys()]);
    },
  };
}
export type StepStore = ReturnType<typeof createStepStore>;

const StepStoreContext = createContext<StepStore | null>(null);

// Gives step hooks the live step store; null when signed out.
export function StepStoreProvider({
  store,
  children,
}: {
  store: StepStore | null;
  children?: ReactNode;
}) {
  return createElement(StepStoreContext.Provider, { value: store }, children);
}

export function useStepStore() {
  return useContext(StepStoreContext);
}
