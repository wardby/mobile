import type { components } from '../schema';
import graphJson from '../__fixtures__/graph.json';
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
