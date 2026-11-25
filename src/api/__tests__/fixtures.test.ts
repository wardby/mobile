import type { components } from '../schema';
import graphJson from '../__fixtures__/graph.json';
import graphagentsJson from '../__fixtures__/graph-agents.json';
import rundetailJson from '../__fixtures__/run-detail.json';
import rundetailstepsoffJson from '../__fixtures__/run-detail-steps-off.json';
import rundetailrequesttruncatedJson from '../__fixtures__/run-detail-request-truncated.json';
import rundetailrequestnullJson from '../__fixtures__/run-detail-request-null.json';
import infraJson from '../__fixtures__/infra.json';
import infrakubernetesJson from '../__fixtures__/infra-kubernetes.json';
import infraunconfiguredJson from '../__fixtures__/infra-unconfigured.json';
import invalidsinceJson from '../__fixtures__/invalid_since.json';
import notfoundJson from '../__fixtures__/not_found.json';
import invalidtokenJson from '../__fixtures__/invalid_token.json';
import internalerrorJson from '../__fixtures__/internal_error.json';

// JSON imports widen string literals. Check their structure here and compare
// them to the fully typed examples below to retain enum validation.
type JsonShape<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? JsonShape<U>[]
    : T extends object
      ? { [K in keyof T]: JsonShape<T[K]> }
      : T;

const graph = {
  generatedAt: '2026-10-01T10:00:00.000Z',
  since: '2026-10-01T10:00:00.000Z',
  limit: 500,
  truncated: false,
  runs: [
    {
      id: 'run-parent',
      parentRunId: null,
      agentId: 'planner',
      agentName: 'Planner',
      agentKind: 'native',
      model: 'planning-model',
      codingProvider: null,
      nativeExecutionMode: 'control-plane',
      warmWorkerName: null,
      status: 'running',
      trigger: {
        kind: 'manual',
      },
      turns: 3,
      tokensIn: 1200,
      tokensOut: 400,
      costUsd: 0.12,
      budgetUsd: 5,
      startedAt: '2026-10-01T10:00:00.000Z',
      finishedAt: null,
      heartbeatAt: '2026-10-01T10:00:00.000Z',
      outcomes: [],
      declaredServices: [],
      services: [],
    },
    {
      id: 'run-coding',
      parentRunId: 'run-parent',
      agentId: 'builder',
      agentName: 'Builder',
      agentKind: 'coding',
      model: 'planning-model',
      codingProvider: 'claude',
      nativeExecutionMode: null,
      warmWorkerName: null,
      status: 'running',
      trigger: {
        kind: 'subagent',
      },
      turns: 3,
      tokensIn: 1200,
      tokensOut: 400,
      costUsd: 0.12,
      budgetUsd: 5,
      startedAt: '2026-10-01T10:00:00.000Z',
      finishedAt: null,
      heartbeatAt: '2026-10-01T10:00:00.000Z',
      outcomes: [],
      declaredServices: [
        {
          name: 'postgres',
          version: '16',
        },
      ],
      services: [
        {
          name: 'postgres',
          state: 'ready',
          attempts: 1,
          reason: null,
          readyAt: '2026-10-01T10:00:00.000Z',
          failedAt: null,
          createdAt: '2026-10-01T10:00:00.000Z',
        },
      ],
    },
    {
      id: 'run-child',
      parentRunId: 'run-coding',
      agentId: 'planner',
      agentName: 'Planner',
      agentKind: 'native',
      model: 'planning-model',
      codingProvider: null,
      nativeExecutionMode: 'control-plane',
      warmWorkerName: null,
      status: 'succeeded',
      trigger: {
        kind: 'subagent',
      },
      turns: 3,
      tokensIn: 1200,
      tokensOut: 400,
      costUsd: 0.12,
      budgetUsd: 5,
      startedAt: '2026-10-01T10:00:00.000Z',
      finishedAt: '2026-10-01T10:00:00.000Z',
      heartbeatAt: '2026-10-01T10:00:00.000Z',
      outcomes: [],
      declaredServices: [],
      services: [],
    },
  ],
  spend: {
    todayUsd: 0.36,
    groups: [
      {
        id: 'engineering',
        name: 'Engineering',
        dailyBudgetUsd: null,
        spentTodayUsd: 0.36,
      },
    ],
  },
} satisfies components['schemas']['graph-snapshot'];
test('graph fixture matches the typed contract example', () => {
  expect(graphJson).toEqual(graph);
});
// Sample agents and flows shared by the Agents tab designs (#102). Each run
// lists only what differs from its agent; the JSON fixture spells out every field.
type GraphRun = components['schemas']['graph-snapshot']['runs'][number];
const graphagentsrun = {
  id: '',
  parentRunId: null,
  agentId: '',
  agentName: '',
  agentKind: 'native',
  model: '',
  codingProvider: null,
  nativeExecutionMode: 'control-plane',
  warmWorkerName: null,
  status: 'succeeded',
  trigger: {
    kind: 'manual',
  },
  turns: 4,
  tokensIn: 2400,
  tokensOut: 800,
  costUsd: 0,
  budgetUsd: 0,
  startedAt: '',
  finishedAt: null,
  heartbeatAt: null,
  outcomes: [],
  declaredServices: [],
  services: [],
} satisfies GraphRun;
const planner = {
  ...graphagentsrun,
  agentId: 'planner',
  agentName: 'Planner',
  model: 'opus-4',
  budgetUsd: 5,
} satisfies GraphRun;
const builder = {
  ...graphagentsrun,
  agentId: 'builder',
  agentName: 'Builder',
  agentKind: 'coding',
  model: 'opus-4',
  codingProvider: 'claude',
  nativeExecutionMode: null,
  budgetUsd: 5,
} satisfies GraphRun;
const tester = {
  ...builder,
  agentId: 'tester',
  agentName: 'Tester',
  model: 'haiku-4',
  budgetUsd: 1,
} satisfies GraphRun;
const researcher = {
  ...graphagentsrun,
  agentId: 'researcher',
  agentName: 'Researcher',
  model: 'sonnet-4',
  budgetUsd: 2,
} satisfies GraphRun;
const reviewer = {
  ...graphagentsrun,
  agentId: 'reviewer',
  agentName: 'Reviewer',
  model: 'sonnet-4',
  budgetUsd: 2,
} satisfies GraphRun;
const triage = {
  ...graphagentsrun,
  agentId: 'triage',
  agentName: 'Triage',
  model: 'haiku-4',
  budgetUsd: 1,
} satisfies GraphRun;
const releasenotes = {
  ...graphagentsrun,
  agentId: 'release-notes',
  agentName: 'Release notes',
  model: 'sonnet-4',
  budgetUsd: 1,
} satisfies GraphRun;
const mobile64 = {
  kind: 'code_host',
  provider: 'github',
  repository: 'wardby/mobile',
  number: 64,
  event: 'review',
} satisfies GraphRun['trigger'];
const mob7 = {
  kind: 'issue',
  provider: 'jira',
  issueKey: 'MOB-7',
  url: 'https://issues.example/MOB-7',
} satisfies GraphRun['trigger'];
const graphagents = {
  generatedAt: '2026-10-01T12:00:00.000Z',
  since: '2026-09-30T12:00:00.000Z',
  limit: 500,
  truncated: false,
  runs: [
    {
      ...planner,
      id: 'planner-failed',
      status: 'failed',
      costUsd: 0.7,
      startedAt: '2026-10-01T03:00:00.000Z',
      finishedAt: '2026-10-01T03:20:00.000Z',
      heartbeatAt: '2026-10-01T03:20:00.000Z',
    },
    {
      ...planner,
      id: 'planner-delegation',
      costUsd: 2.2,
      startedAt: '2026-10-01T09:00:00.000Z',
      finishedAt: '2026-10-01T10:10:00.000Z',
      heartbeatAt: '2026-10-01T10:10:00.000Z',
    },
    {
      ...researcher,
      id: 'researcher-planner',
      parentRunId: 'planner-delegation',
      trigger: { kind: 'subagent' },
      costUsd: 0.3,
      startedAt: '2026-10-01T09:02:00.000Z',
      finishedAt: '2026-10-01T09:12:00.000Z',
      heartbeatAt: '2026-10-01T09:12:00.000Z',
    },
    {
      ...builder,
      id: 'builder-sub',
      parentRunId: 'planner-delegation',
      trigger: { kind: 'subagent' },
      costUsd: 1.5,
      startedAt: '2026-10-01T09:05:00.000Z',
      finishedAt: '2026-10-01T09:50:00.000Z',
      heartbeatAt: '2026-10-01T09:50:00.000Z',
      outcomes: [
        {
          kind: 'pull_request',
          provider: 'github',
          repository: 'wardby/mobile',
          number: 64,
          url: 'https://example.invalid/wardby/mobile/pull/64',
          state: 'open',
          at: '2026-10-01T09:48:00.000Z',
        },
      ],
    },
    {
      ...tester,
      id: 'tester-sub',
      parentRunId: 'builder-sub',
      status: 'budget_exhausted',
      trigger: { kind: 'subagent' },
      costUsd: 1,
      startedAt: '2026-10-01T09:20:00.000Z',
      finishedAt: '2026-10-01T09:35:00.000Z',
      heartbeatAt: '2026-10-01T09:35:00.000Z',
    },
    {
      ...reviewer,
      id: 'reviewer-64-1',
      trigger: mobile64,
      costUsd: 0.35,
      startedAt: '2026-10-01T10:00:00.000Z',
      finishedAt: '2026-10-01T10:08:00.000Z',
      heartbeatAt: '2026-10-01T10:08:00.000Z',
    },
    {
      ...builder,
      id: 'builder-64-fix-1',
      trigger: { ...mobile64, event: 'mention' },
      costUsd: 0.8,
      startedAt: '2026-10-01T10:15:00.000Z',
      finishedAt: '2026-10-01T10:40:00.000Z',
      heartbeatAt: '2026-10-01T10:40:00.000Z',
    },
    {
      ...triage,
      id: 'triage-issue',
      trigger: mob7,
      costUsd: 0.2,
      startedAt: '2026-10-01T10:30:00.000Z',
      finishedAt: '2026-10-01T10:45:00.000Z',
      heartbeatAt: '2026-10-01T10:45:00.000Z',
    },
    {
      ...researcher,
      id: 'researcher-triage',
      parentRunId: 'triage-issue',
      trigger: { kind: 'subagent' },
      costUsd: 0.25,
      startedAt: '2026-10-01T10:32:00.000Z',
      finishedAt: '2026-10-01T10:40:00.000Z',
      heartbeatAt: '2026-10-01T10:40:00.000Z',
    },
    {
      ...reviewer,
      id: 'reviewer-64-2',
      trigger: mobile64,
      costUsd: 0.3,
      startedAt: '2026-10-01T10:50:00.000Z',
      finishedAt: '2026-10-01T10:58:00.000Z',
      heartbeatAt: '2026-10-01T10:58:00.000Z',
    },
    {
      ...releasenotes,
      id: 'release-notes-scheduled',
      trigger: { kind: 'scheduled', schedule: '0 9 * * *' },
      costUsd: 0.15,
      startedAt: '2026-10-01T09:00:00.000Z',
      finishedAt: '2026-10-01T09:04:00.000Z',
      heartbeatAt: '2026-10-01T09:04:00.000Z',
    },
    {
      ...builder,
      id: 'builder-311',
      costUsd: 1.1,
      startedAt: '2026-10-01T11:00:00.000Z',
      finishedAt: '2026-10-01T11:25:00.000Z',
      heartbeatAt: '2026-10-01T11:25:00.000Z',
      outcomes: [
        {
          kind: 'pull_request',
          provider: 'github',
          repository: 'wardby/wardby',
          number: 311,
          url: 'https://example.invalid/wardby/wardby/pull/311',
          state: 'open',
          at: '2026-10-01T11:24:00.000Z',
        },
      ],
    },
    {
      ...reviewer,
      id: 'reviewer-311',
      trigger: { ...mobile64, repository: 'wardby/wardby', number: 311 },
      costUsd: 0.25,
      startedAt: '2026-10-01T11:30:00.000Z',
      finishedAt: '2026-10-01T11:36:00.000Z',
      heartbeatAt: '2026-10-01T11:36:00.000Z',
    },
    {
      ...releasenotes,
      id: 'release-notes-host-event',
      trigger: { kind: 'host_event' },
      costUsd: 0.12,
      startedAt: '2026-10-01T11:40:00.000Z',
      finishedAt: '2026-10-01T11:43:00.000Z',
      heartbeatAt: '2026-10-01T11:43:00.000Z',
    },
    {
      ...planner,
      id: 'planner-issue',
      status: 'running',
      trigger: mob7,
      costUsd: 1.9,
      startedAt: '2026-10-01T11:48:00.000Z',
      heartbeatAt: '2026-10-01T11:59:00.000Z',
    },
    {
      ...builder,
      id: 'builder-64-fix-2',
      status: 'running',
      trigger: { ...mobile64, event: 'mention' },
      costUsd: 0.4,
      startedAt: '2026-10-01T11:58:00.000Z',
      heartbeatAt: '2026-10-01T11:59:00.000Z',
    },
  ],
  spend: {
    todayUsd: 11.52,
    groups: [
      {
        id: 'engineering',
        name: 'Engineering',
        dailyBudgetUsd: 25,
        spentTodayUsd: 11.52,
      },
    ],
  },
} satisfies components['schemas']['graph-snapshot'];
test('graph-agents fixture matches the typed contract example', () => {
  expect(graphagentsJson).toEqual(graphagents);
});
test('graph-agents fixture holds the sample agents and flows of #102', () => {
  const runs: GraphRun[] = graphagents.runs;
  const run = (id: string) => runs.find((item) => item.id === id)!;
  const codeHost = (event: 'review' | 'mention', repository: string, number: number) =>
    runs.filter(
      ({ trigger }) =>
        trigger.kind === 'code_host' &&
        trigger.event === event &&
        trigger.repository === repository &&
        trigger.number === number,
    );
  // Planner -> Builder -> Tester, three levels.
  expect(run(run('tester-sub').parentRunId!).parentRunId).toBe('planner-delegation');
  expect(run('planner-delegation').parentRunId).toBeNull();
  // Researcher is a sub-agent of two leads.
  const researcherLeads = runs
    .filter((item) => item.agentId === 'researcher')
    .map((item) => run(item.parentRunId!).agentId);
  expect(researcherLeads).toEqual(['planner', 'triage']);
  // mobile#64: opened in the delegation tree, two reviews and two fix rounds.
  expect(run('builder-sub').outcomes[0]).toMatchObject({ repository: 'wardby/mobile', number: 64 });
  expect(codeHost('review', 'wardby/mobile', 64)).toHaveLength(2);
  expect(codeHost('mention', 'wardby/mobile', 64)).toHaveLength(2);
  // wardby#311: opened by a top-level run, one review.
  expect(run('builder-311').parentRunId).toBeNull();
  expect(run('builder-311').outcomes[0]).toMatchObject({
    repository: 'wardby/wardby',
    number: 311,
  });
  expect(codeHost('review', 'wardby/wardby', 311)).toHaveLength(1);
  // MOB-7 is handed from Triage to Planner.
  const issueAgents = runs.flatMap(({ trigger, agentId }) =>
    trigger.kind === 'issue' && trigger.issueKey === 'MOB-7' ? [agentId] : [],
  );
  expect(issueAgents).toEqual(['triage', 'planner']);
  // Release notes runs on a schedule and on a host event.
  const releaseTriggers = runs
    .filter((item) => item.agentId === 'release-notes')
    .map((item) => item.trigger.kind);
  expect(releaseTriggers).toEqual(['scheduled', 'host_event']);
  const statuses = new Set(runs.map((item) => item.status));
  for (const status of ['running', 'failed', 'budget_exhausted', 'succeeded'])
    expect(statuses).toContain(status);
  expect(new Set(runs.map((item) => item.model)).size).toBeGreaterThanOrEqual(2);
  const repositories = new Set(
    runs.flatMap((item) => [
      ...(item.trigger.kind === 'code_host' ? [item.trigger.repository] : []),
      ...item.outcomes.flatMap((outcome) =>
        outcome.kind === 'pull_request' ? [outcome.repository] : [],
      ),
    ]),
  );
  expect(repositories.size).toBeGreaterThanOrEqual(2);
  // Only reserved example hosts, no tokens.
  const text = JSON.stringify(graphagentsJson);
  const hosts = new Set([...text.matchAll(/https?:\/\/([^/"]+)/g)].map((match) => match[1]));
  expect([...hosts].sort()).toEqual(['example.invalid', 'issues.example']);
  expect(text).not.toMatch(/secret|password|bearer|ghp_|sk-/i);
});
const rundetail = {
  id: 'run-coding',
  parentRunId: 'run-parent',
  agentId: 'builder',
  agentName: 'Builder',
  agentKind: 'coding',
  model: 'planning-model',
  codingProvider: 'claude',
  nativeExecutionMode: null,
  warmWorkerName: null,
  status: 'running',
  trigger: {
    kind: 'subagent',
  },
  turns: 3,
  tokensIn: 1200,
  tokensOut: 400,
  costUsd: 0.12,
  budgetUsd: 5,
  startedAt: '2026-10-01T10:00:00.000Z',
  finishedAt: null,
  heartbeatAt: '2026-10-01T10:00:00.000Z',
  outcomes: [],
  declaredServices: [
    {
      name: 'postgres',
      version: '16',
    },
  ],
  services: [
    {
      name: 'postgres',
      state: 'ready',
      attempts: 1,
      reason: null,
      readyAt: '2026-10-01T10:00:00.000Z',
      failedAt: null,
      createdAt: '2026-10-01T10:00:00.000Z',
    },
  ],
  error: null,
  finalText: null,
  childRunIds: ['run-child'],
  coding: {
    provider: 'github',
    repository: 'team/project',
    baseRef: 'main',
    headRef: 'fix-search',
    queuedAt: null,
    failureCategory: null,
    services: [
      {
        name: 'postgres',
        version: '16',
        image: 'postgres:16',
        envNames: [],
      },
    ],
  },
  steps: [
    {
      seq: 13,
      at: '2026-10-01T10:01:00.000Z',
      kind: 'tool',
      tool: 'Read',
      summary: 'src/live/stream.ts',
      status: 'ok',
    },
    {
      seq: 14,
      at: '2026-10-01T10:01:30.000Z',
      kind: 'said',
      tool: null,
      summary: "I'll run the tests next.",
      status: null,
    },
    {
      seq: 15,
      at: '2026-10-01T10:02:00.000Z',
      kind: 'tool',
      tool: 'Bash',
      summary: 'npm run lint',
      status: 'exit 1',
    },
    {
      seq: 16,
      at: '2026-10-01T10:03:00.000Z',
      kind: 'tool',
      tool: 'Edit',
      summary: 'app/runs/[id].tsx',
      status: 'error',
    },
    {
      seq: 17,
      at: '2026-10-01T10:04:00.000Z',
      kind: 'tool',
      tool: 'Bash',
      summary: 'echo **bold** [link](https://example.test/x)',
      status: 'ok',
    },
    {
      seq: 18,
      at: '2026-10-01T10:05:00.000Z',
      kind: 'tool',
      tool: 'Bash',
      summary: 'npm test',
      status: null,
    },
  ],
  stepsOmitted: 12,
  stepsDropped: 0,
  request:
    '## Search returns stale results\n\nSearching right after an edit shows the old title. See [the report](https://example.test/issues/12) for steps.\n\nRepro:\n1. Edit a run title.\n2. Run `npm run search -- --fresh` straight away.\n3. The old title is listed.\n\nExpected: the new title.\nActual: the old title, until the cache expires.',
  requestTruncated: false,
} satisfies components['schemas']['run-detail'];
test('run-detail fixture matches the typed contract example', () => {
  expect(rundetailJson).toEqual(rundetail);
});
const rundetailstepsoff = {
  ...rundetail,
  status: 'succeeded',
  finishedAt: '2026-10-01T10:06:00.000Z',
  steps: [],
  stepsOmitted: 0,
  stepsDropped: 0,
} satisfies components['schemas']['run-detail'];
test('run-detail-steps-off fixture matches the typed contract example', () => {
  expect(rundetailstepsoffJson).toEqual(rundetailstepsoff);
});
// A step event announces a step and again carries its status once known.
const stepevent = {
  kind: 'step',
  runId: 'run-coding',
  seq: 18,
  stepKind: 'tool',
  tool: 'Bash',
  summary: 'npm test',
  status: 'ok',
  at: '2026-10-01T10:05:00.000Z',
} satisfies components['schemas']['viewer-event'];
test('step event example describes a run-detail step by seq', () => {
  const { runId, seq, stepKind, tool, summary, at } = stepevent;
  expect(runId).toBe(rundetail.id);
  expect(rundetail.steps.find((step) => step.seq === seq)).toEqual({
    seq,
    at,
    kind: stepKind,
    tool,
    summary,
    status: null,
  });
});
const infra = {
  launcher: 'docker',
  kubernetes: null,
  native: {
    launcher: 'docker',
    warmPoolSize: 2,
    kubernetes: null,
  },
} satisfies components['schemas']['infra-info'];
test('infra fixture matches the typed contract example', () => {
  expect(infraJson).toEqual(infra);
});
const infrakubernetes = {
  launcher: 'kubernetes',
  kubernetes: {
    namespace: 'example-namespace',
    platform: 'example-platform',
    runtimeClass: 'example-runtime',
    proxyService: 'example-proxy',
    runLabel: 'example.test/run',
    runLabelHashChars: 12,
    componentLabel: {
      'example.test/component': 'coding',
    },
    managedByLabel: {
      'example.test/managed-by': 'wardby',
    },
  },
  native: {
    launcher: 'kubernetes',
    warmPoolSize: 3,
    kubernetes: {
      namespace: 'example-native-namespace',
      runtimeClass: null,
      runLabel: 'example.test/native-run',
      componentLabel: {
        'example.test/component': 'native',
      },
      warmPoolLabel: {
        'example.test/pool': 'warm',
        'example.test/tier': 'native',
      },
      warmWorkerLabel: 'example.test/warm-worker',
    },
  },
} satisfies components['schemas']['infra-info'];
test('infra-kubernetes fixture matches the typed contract example', () => {
  expect(infrakubernetesJson).toEqual(infrakubernetes);
});
const infraunconfigured = {
  launcher: 'local',
  kubernetes: null,
  native: null,
} satisfies components['schemas']['infra-info'];
test('infra-unconfigured fixture matches the typed contract example', () => {
  expect(infraunconfiguredJson).toEqual(infraunconfigured);
});
const invalidsince = {
  error: 'invalid_since',
} satisfies components['schemas']['ViewerError'];
test('invalid_since fixture matches the typed contract example', () => {
  expect(invalidsinceJson).toEqual(invalidsince);
});
const notfound = {
  error: 'not_found',
} satisfies components['schemas']['ViewerError'];
test('not_found fixture matches the typed contract example', () => {
  expect(notfoundJson).toEqual(notfound);
});
const invalidtoken = {
  error: 'invalid_token',
} satisfies components['schemas']['ViewerError'];
test('invalid_token fixture matches the typed contract example', () => {
  expect(invalidtokenJson).toEqual(invalidtoken);
});
const internalerror = {
  error: 'internal_error',
  id: 'failure-1',
} satisfies components['schemas']['ViewerInternalError'];
test('internal_error fixture matches the typed contract example', () => {
  expect(internalerrorJson).toEqual(internalerror);
});
graphJson satisfies JsonShape<components['schemas']['graph-snapshot']>;
graphagentsJson satisfies JsonShape<components['schemas']['graph-snapshot']>;
rundetailJson satisfies JsonShape<components['schemas']['run-detail']>;
rundetailstepsoffJson satisfies JsonShape<components['schemas']['run-detail']>;
rundetailrequesttruncatedJson satisfies JsonShape<components['schemas']['run-detail']>;
rundetailrequestnullJson satisfies JsonShape<components['schemas']['run-detail']>;
infraJson satisfies JsonShape<components['schemas']['infra-info']>;
infrakubernetesJson satisfies JsonShape<components['schemas']['infra-info']>;
infraunconfiguredJson satisfies JsonShape<components['schemas']['infra-info']>;
invalidsinceJson satisfies JsonShape<components['schemas']['ViewerError']>;
notfoundJson satisfies JsonShape<components['schemas']['ViewerError']>;
invalidtokenJson satisfies JsonShape<components['schemas']['ViewerError']>;
internalerrorJson satisfies JsonShape<components['schemas']['ViewerInternalError']>;
