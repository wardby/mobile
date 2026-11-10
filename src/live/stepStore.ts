import { createContext, createElement, useContext, type ReactNode } from 'react';
import { capSteps, maxLiveSteps, mergeSteps, type Step } from './steps';

const none: Step[] = [];

// Live steps per run, kept apart from the graph so a step never replaces the
// graph object. Listeners are keyed by run id.
export function createStepStore() {
  const steps = new Map<string, Step[]>();
  const listeners = new Map<string, Set<() => void>>();
  const notify = (runId: string) => listeners.get(runId)?.forEach((listener) => listener());
  const drop = (runIds: string[]) => {
    runIds.forEach((runId) => steps.delete(runId));
    runIds.forEach(notify);
  };
  return {
    merge(runId: string, incoming: Step[]) {
      const current = steps.get(runId) ?? none;
      const next = capSteps(mergeSteps(current, incoming), maxLiveSteps);
      if (next === current) return;
      steps.set(runId, next);
      notify(runId);
    },
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
    // Keeps only the listed runs.
    prune(runIds: Iterable<string>) {
      const keep = new Set(runIds);
      drop([...steps.keys()].filter((runId) => !keep.has(runId)));
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
