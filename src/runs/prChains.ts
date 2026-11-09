import type { components } from '../api/schema';
export type Run = components['schemas']['graph-snapshot']['runs'][number];
type Ref = { key: string; label: string; url: string | null };
export type ChainGroup = Ref & {
  kind: 'group';
  runs: Run[];
  state: 'running' | 'failed' | 'succeeded';
  costUsd: number;
};
export type ChainEntry = ChainGroup | { kind: 'run'; run: Run };

function pullRequestOutcome(run: Run, runs: Run[]) {
  const visited = new Set<string>();
  const pending = [run];
  while (pending.length) {
    const current = pending.pop()!;
    if (visited.has(current.id)) continue;
    visited.add(current.id);
    const outcome = current.outcomes.find((item) => item.kind === 'pull_request');
    if (outcome) return outcome;
    pending.push(...runs.filter((item) => item.parentRunId === current.id).reverse());
  }
  return null;
}

function prRef(repository: string, number: number, url: string | null): Ref {
  return { key: repository + '#' + number, label: repository.split('/').pop() + '#' + number, url };
}

export function prRefOf(run: Run, runs: Run[]): Ref | null {
  const trigger = run.trigger;
  if (trigger.kind === 'code_host' && trigger.number !== null)
    return prRef(
      trigger.repository,
      trigger.number,
      trigger.provider === 'github'
        ? 'https://github.com/' + trigger.repository + '/pull/' + trigger.number
        : null,
    );
  if (trigger.kind === 'issue')
    return { key: 'issue:' + trigger.issueKey, label: trigger.issueKey, url: trigger.url };
  const outcome = pullRequestOutcome(run, runs);
  return outcome ? prRef(outcome.repository, outcome.number, outcome.url) : null;
}

export function eventLabel(
  run: Run,
  runs: Run[] = [run],
): 'opened' | 'review' | 'follow-up' | null {
  if (run.trigger.kind === 'code_host')
    return run.trigger.event === 'review' ? 'review' : 'follow-up';
  return pullRequestOutcome(run, runs) ? 'opened' : null;
}

// Only top-level runs in the selected range/agent enter chains. Full graph context
// resolves descendant outcomes without including descendant costs or rows.
export function asChains(runs: Run[], allRuns: Run[] = runs): ChainEntry[] {
  const entries: ChainEntry[] = [];
  const groups = new Map<string, ChainGroup>();
  for (const run of [...runs].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))) {
    const ref = prRefOf(run, allRuns);
    if (!ref) {
      entries.push({ kind: 'run', run });
      continue;
    }
    let group = groups.get(ref.key);
    if (!group) {
      group = {
        kind: 'group',
        ...ref,
        runs: [],
        state: run.status === 'succeeded' ? 'succeeded' : 'failed',
        costUsd: 0,
      };
      groups.set(ref.key, group);
      entries.push(group);
    }
    group.runs.push(run);
    group.costUsd += run.costUsd;
    if (run.status === 'pending' || run.status === 'running') group.state = 'running';
  }
  return entries.map((entry) =>
    entry.kind === 'group' && entry.runs.length === 1 ? { kind: 'run', run: entry.runs[0] } : entry,
  );
}
