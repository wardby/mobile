import type { components } from '../api/schema';

export type Step = components['schemas']['run-detail']['steps'][number];

// Steps held in memory per run. The server may send more; keep the newest.
export const maxLiveSteps = 100;

// Reads a parsed `event: step` payload. Returns null for a malformed frame.
export function stepFromEvent(data: unknown): { runId: string; step: Step } | null {
  if (typeof data !== 'object' || data === null) return null;
  const { runId, seq, stepKind, tool, summary, status, at } = data as Record<string, unknown>;
  if (typeof runId !== 'string' || runId === '') return null;
  if (typeof seq !== 'number' || !Number.isInteger(seq)) return null;
  if (stepKind !== 'tool' && stepKind !== 'said') return null;
  if (tool !== null && typeof tool !== 'string') return null;
  if (typeof summary !== 'string' || typeof at !== 'string') return null;
  if (status !== null && typeof status !== 'string') return null;
  return { runId, step: { seq, at, kind: stepKind, tool, summary, status } };
}

// Upserts by seq, sorted by seq ascending. A known status is never replaced by
// null (a late status survives an older copy); other fields come from incoming.
// A step with the same values keeps its object, and when nothing changed the
// existing array comes back, so duplicate frames create no new objects.
export function mergeSteps(existing: Step[], incoming: Step[]): Step[] {
  const bySeq = new Map(existing.map((step) => [step.seq, step]));
  for (const step of incoming) {
    const known = bySeq.get(step.seq);
    const next = known ? { ...step, status: step.status ?? known.status } : step;
    if (!known || !sameStep(known, next)) bySeq.set(step.seq, next);
  }
  const merged = [...bySeq.values()].sort((a, b) => a.seq - b.seq);
  const unchanged =
    merged.length === existing.length && merged.every((step, index) => step === existing[index]);
  return unchanged ? existing : merged;
}

function sameStep(a: Step, b: Step) {
  return (
    a.seq === b.seq &&
    a.at === b.at &&
    a.kind === b.kind &&
    a.tool === b.tool &&
    a.summary === b.summary &&
    a.status === b.status
  );
}

// Keeps the newest `max` steps by seq, oldest first.
export function capSteps(steps: Step[], max: number): Step[] {
  if (steps.length <= max) return steps;
  return [...steps].sort((a, b) => a.seq - b.seq).slice(-max);
}
