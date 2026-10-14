import { agentOptions, matchesAgent } from '../../src/runs/agentFilter';
import fixture from '../../src/api/__fixtures__/graph.json';
import type { components } from '../../src/api/schema';
type Run = components['schemas']['graph-snapshot']['runs'][number];
const since = Date.parse('2026-10-01T00:00:00Z');
const run = (agentId: string, agentName: string, overrides: Partial<Run> = {}): Run => ({
  ...(fixture.runs[0] as Run),
  agentId,
  agentName,
  parentRunId: null,
  startedAt: new Date(since + 1000).toISOString(),
  ...overrides,
});
test('counts only top-level runs strictly inside the range', () => {
  expect(
    agentOptions(
      [
        run('a', 'Alpha'),
        run('a', 'Alpha'),
        run('a', 'Alpha', { parentRunId: 'parent' }),
        run('a', 'Alpha', { startedAt: new Date(since).toISOString() }),
      ],
      since,
    ),
  ).toEqual([{ agentId: 'a', agentName: 'Alpha', runs: 2 }]);
});
test('sorts names case-insensitively with id breaking ties', () => {
  expect(
    agentOptions([run('z', 'alpha'), run('b', 'Beta'), run('a', 'ALPHA')], since).map(
      (item) => item.agentId,
    ),
  ).toEqual(['a', 'z', 'b']);
});
test('excludes agents with only older runs', () => {
  expect(
    agentOptions([run('old', 'Old', { startedAt: new Date(since - 1).toISOString() })], since),
  ).toEqual([]);
});
test('returns no options for an empty graph', () => {
  expect(agentOptions([], since)).toEqual([]);
});
test.each([
  [null, true],
  ['a', true],
  ['b', false],
] as const)('matchesAgent with %s returns %s', (id, expected) => {
  expect(matchesAgent(run('a', 'Alpha'), id)).toBe(expected);
});
