import type { components } from '../api/schema';
export type Graph = components['schemas']['graph-snapshot'];
type Run = Graph['runs'][number];
export type AgentRow = { agentId: string; agentName: string; costUsd: number; runs: number };
export type IssueRow = {
  key: string;
  label: string;
  url: string | null;
  costUsd: number;
  runs: number;
};
const counted = (graph: Graph, start: Date) =>
  graph.runs.filter((run) => Date.parse(run.startedAt) >= start.getTime());
export function summarize(graph: Graph, start: Date) {
  const runs = counted(graph, start);
  return {
    totalUsd: runs.reduce((sum, run) => sum + run.costUsd, 0),
    runs: runs.length,
    truncated: graph.truncated,
  };
}
export function byAgent(graph: Graph, start: Date): AgentRow[] {
  const rows = new Map<string, AgentRow>();
  for (const run of counted(graph, start)) {
    const row = rows.get(run.agentId) ?? {
      agentId: run.agentId,
      agentName: run.agentName,
      costUsd: 0,
      runs: 0,
    };
    row.costUsd += run.costUsd;
    row.runs++;
    rows.set(run.agentId, row);
  }
  return [...rows.values()].sort(
    (a, b) => b.costUsd - a.costUsd || a.agentName.localeCompare(b.agentName),
  );
}
const hostKey = (provider: string, repository: string, number: number) =>
  `code_host:${provider}:${repository}#${number}`;
export function byIssue(graph: Graph, start: Date): IssueRow[] {
  const runs = new Map(graph.runs.map((run) => [run.id, run]));
  function root(run: Run): Run {
    const seen = new Set<string>();
    while (run.parentRunId && runs.has(run.parentRunId) && !seen.has(run.parentRunId)) {
      seen.add(run.id);
      run = runs.get(run.parentRunId)!;
    }
    return run;
  }
  const items = new Map<string, Omit<IssueRow, 'costUsd' | 'runs'>>();
  function item(run: Run): string {
    const trigger = root(run).trigger;
    if (trigger.kind === 'issue') {
      const key = `issue:${trigger.provider}:${trigger.issueKey}`;
      items.set(key, { key, label: trigger.issueKey, url: trigger.url });
      return key;
    }
    if (trigger.kind === 'code_host' && trigger.number !== null) {
      const key = hostKey(trigger.provider, trigger.repository, trigger.number);
      items.set(key, {
        key,
        label: `${trigger.repository} #${trigger.number}`,
        url:
          trigger.provider === 'github'
            ? `https://github.com/${trigger.repository}/issues/${trigger.number}`
            : null,
      });
      return key;
    }
    return 'unlinked';
  }
  const attributed = new Map(graph.runs.map((run) => [run.id, item(run)]));
  const knownPrs = new Set<string>();
  const rollups = new Map<string, string>();
  function resolve(key: string): string {
    const seen = new Set<string>();
    while (rollups.has(key) && !seen.has(key)) {
      seen.add(key);
      key = rollups.get(key)!;
    }
    return key;
  }
  for (const run of graph.runs) {
    for (const outcome of run.outcomes) {
      if (outcome.kind !== 'pull_request') continue;
      const key = hostKey(outcome.provider, outcome.repository, outcome.number);
      knownPrs.add(key);
      const target = resolve(attributed.get(run.id)!);
      // Ignore self links and edges that would create a cycle. Chained PRs
      // resolve transitively even when their opening runs arrive out of order.
      if (target !== 'unlinked' && resolve(target) !== key && !rollups.has(key))
        rollups.set(key, target);
    }
  }
  const rows = new Map<string, IssueRow>();
  for (const run of counted(graph, start)) {
    const key = resolve(attributed.get(run.id)!);
    const info = items.get(key) ?? { key: 'unlinked', label: 'Not linked to an issue', url: null };
    const row = rows.get(key) ?? {
      ...info,
      label: knownPrs.has(key) ? info.label.replace(' #', ' PR #') : info.label,
      costUsd: 0,
      runs: 0,
    };
    row.costUsd += run.costUsd;
    row.runs++;
    rows.set(key, row);
  }
  const unlinked = rows.get('unlinked') ?? {
    key: 'unlinked',
    label: 'Not linked to an issue',
    url: null,
    costUsd: 0,
    runs: 0,
  };
  return [...rows.values()]
    .filter((row) => row.key !== 'unlinked')
    .sort((a, b) => b.costUsd - a.costUsd || a.label.localeCompare(b.label))
    .concat(unlinked);
}
