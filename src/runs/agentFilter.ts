import type { components } from '../api/schema';

type Run = components['schemas']['graph-snapshot']['runs'][number];
export type AgentOption = { agentId: string; agentName: string; runs: number };

export function agentOptions(runs: readonly Run[], since: number): AgentOption[] {
  const agents = new Map<string, AgentOption>();
  for (const run of runs) {
    if (run.parentRunId !== null || Date.parse(run.startedAt) <= since) continue;
    const agent = agents.get(run.agentId);
    if (agent) agent.runs++;
    else agents.set(run.agentId, { agentId: run.agentId, agentName: run.agentName, runs: 1 });
  }
  return [...agents.values()].sort(
    (a, b) =>
      a.agentName.toLowerCase().localeCompare(b.agentName.toLowerCase()) ||
      a.agentId.localeCompare(b.agentId),
  );
}

export function matchesAgent(run: Run, agentId: string | null): boolean {
  return agentId === null || run.agentId === agentId;
}
