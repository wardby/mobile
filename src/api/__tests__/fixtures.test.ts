import type { components } from '../schema';
import graphJson from '../__fixtures__/graph.json';
import rundetailJson from '../__fixtures__/run-detail.json';
import rundetailstepsoffJson from '../__fixtures__/run-detail-steps-off.json';
import infraJson from '../__fixtures__/infra.json';
import invalidsinceJson from '../__fixtures__/invalid_since.json';
import notfoundJson from '../__fixtures__/not_found.json';
import invalidtokenJson from '../__fixtures__/invalid_token.json';

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
graphJson satisfies JsonShape<components['schemas']['graph-snapshot']>;
rundetailJson satisfies JsonShape<components['schemas']['run-detail']>;
rundetailstepsoffJson satisfies JsonShape<components['schemas']['run-detail']>;
infraJson satisfies JsonShape<components['schemas']['infra-info']>;
invalidsinceJson satisfies JsonShape<components['schemas']['ViewerError']>;
notfoundJson satisfies JsonShape<components['schemas']['ViewerError']>;
invalidtokenJson satisfies JsonShape<components['schemas']['ViewerError']>;
