import fixture from '../../src/api/__fixtures__/graph.json';
import { periodStart, periodEnd, resetLabel } from '../../src/spend/period';
import { summarize, byAgent, byIssue, type Graph } from '../../src/spend/helpers';
const base = fixture.runs[0] as Graph['runs'][number];
const start = new Date('2026-09-28T00:00:00Z');
const run = (id: string, overrides: Partial<typeof base> = {}) => ({
  ...base,
  id,
  agentId: id,
  agentName: id,
  parentRunId: null,
  startedAt: start.toISOString(),
  costUsd: 1,
  outcomes: [],
  trigger: { kind: 'manual' as const },
  ...overrides,
});
const graph = (runs: Graph['runs']) => ({ ...fixture, runs, truncated: true }) as Graph;
test.each([
  [
    '2026-10-14T13:20:00Z',
    '2026-10-14',
    '2026-10-12',
    '2026-10-01',
    '2026-10-15',
    '2026-10-19',
    '2026-11-01',
  ],
  [
    '2026-11-01T00:00:00Z',
    '2026-11-01',
    '2026-10-26',
    '2026-11-01',
    '2026-11-02',
    '2026-11-02',
    '2026-12-01',
  ],
  [
    '2027-01-01T00:00:00Z',
    '2027-01-01',
    '2026-12-28',
    '2027-01-01',
    '2027-01-02',
    '2027-01-04',
    '2027-02-01',
  ],
])('UTC calendar boundaries at %s', (now, day, week, month, dayEnd, weekEnd, monthEnd) => {
  const date = new Date(now);
  (['day', 'week', 'month'] as const).forEach((period, i) => {
    expect(periodStart(period, date).toISOString()).toBe([day, week, month][i] + 'T00:00:00.000Z');
    expect(periodEnd(period, date).toISOString()).toBe(
      [dayEnd, weekEnd, monthEnd][i] + 'T00:00:00.000Z',
    );
  });
  expect(date.toISOString()).toBe(new Date(now).toISOString());
});
test('reset label uses local time, including the previous local day', () => {
  expect(resetLabel('week', new Date('2026-10-14T12:00:00Z'), 'America/New_York')).toBe(
    'Resets Sun 8:00 pm',
  );
  expect(resetLabel('day', new Date('2026-10-14T12:00:00Z'), 'America/New_York')).toBe(
    'Resets 8:00 pm',
  );
});
test('summary excludes old ancestors and pending runs and retains truncation', () => {
  expect(
    summarize(
      graph([
        run('old', { startedAt: '2026-09-01T00:00:00Z' }),
        run('pending', { status: 'pending', startedAt: '2026-09-01T00:00:00Z' }),
        run('new'),
      ]),
      start,
    ),
  ).toEqual({ totalUsd: 1, runs: 1, truncated: true });
});
test('agents sort by cost then name and conserve totals', () => {
  const g = graph([
    run('z'),
    run('a'),
    run('big', { costUsd: 3 }),
    run('child', { agentId: 'big', agentName: 'big' }),
  ]);
  const rows = byAgent(g, start);
  expect(rows.map((r) => r.agentName)).toEqual(['big', 'a', 'z']);
  expect(rows.reduce((n, r) => n + r.costUsd, 0)).toBe(summarize(g, start).totalUsd);
});
const host = (number: number) => ({
  kind: 'code_host' as const,
  provider: 'github',
  repository: 'wardby/mobile',
  number,
  event: 'mention' as const,
});
const pr = (number: number) => ({
  kind: 'pull_request' as const,
  provider: 'github',
  repository: 'wardby/mobile',
  number,
  url: '',
  state: null,
  at: null,
});
test.each(['github', 'jira'])(
  '%s issue rolls up delivery, PR reviews, followups and subruns',
  (provider) => {
    const trigger =
      provider === 'github'
        ? host(43)
        : {
            kind: 'issue' as const,
            provider: 'jira',
            issueKey: 'SCRUM-13',
            url: 'https://jira.example/browse/SCRUM-13',
          };
    const g = graph([
      run('root', { trigger }),
      run('delivery', { parentRunId: 'root', outcomes: [pr(50)] }),
      run('review', { trigger: host(50) }),
      run('followup', { trigger: host(50), outcomes: [pr(51)] }),
      run('nested', { trigger: host(51) }),
      run('sub', { parentRunId: 'review' }),
      run('sub2', { parentRunId: 'followup' }),
    ]);
    const rows = byIssue(g, start);
    expect(rows[0]).toMatchObject({
      label: provider === 'github' ? 'wardby/mobile #43' : 'SCRUM-13',
      costUsd: 7,
      runs: 7,
    });
    if (provider === 'jira')
      expect(rows[0].url).toBe(trigger.kind === 'issue' ? trigger.url : null);
    expect(rows.reduce((n, r) => n + r.costUsd, 0)).toBe(summarize(g, start).totalUsd);
  },
);
test('known orphan PR, old parent attribution, and unlinked triggers conserve totals', () => {
  const g = graph([
    run('old', { startedAt: '2026-09-01T00:00:00Z', trigger: host(43) }),
    run('child', { parentRunId: 'old' }),
    run('orphan', { trigger: host(40), outcomes: [pr(40)] }),
    run('manual'),
    run('schedule', { trigger: { kind: 'scheduled', schedule: null } }),
    run('webhook', { trigger: { kind: 'webhook' } }),
  ]);
  const rows = byIssue(g, start);
  expect(rows.find((r) => r.label === 'wardby/mobile PR #40')).toBeTruthy();
  expect(rows.find((r) => r.label === 'wardby/mobile #43')).toMatchObject({ costUsd: 1, runs: 1 });
  expect(rows.at(-1)).toMatchObject({ key: 'unlinked', costUsd: 3, runs: 3 });
  expect(rows.reduce((n, r) => n + r.costUsd, 0)).toBe(summarize(g, start).totalUsd);
});
