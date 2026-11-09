import fixture from '../../src/api/__fixtures__/graph-chains.json';
import type { components } from '../../src/api/schema';
import { asChains, eventLabel, prRefOf } from '../../src/runs/prChains';

type Run = components['schemas']['graph-snapshot']['runs'][number];
const runs = fixture.runs as Run[];
const [opened, review, followUp, builder, child, issue, scheduled] = runs;
const ref = {
  key: 'wardby/wardby-mobile#64',
  label: 'wardby-mobile#64',
  url: 'https://github.com/wardby/wardby-mobile/pull/64',
};

test('code host refs include owner-less labels and only GitHub gets a synthesized URL', () => {
  expect(prRefOf(review, runs)).toEqual(ref);
  expect(
    prRefOf(
      { ...review, trigger: { ...review.trigger, provider: 'other' } as Run['trigger'] },
      runs,
    ),
  ).toEqual({ ...ref, url: null });
});
test('null code host number falls through to outcomes; issue triggers take precedence', () => {
  expect(
    prRefOf({ ...opened, trigger: { ...review.trigger, number: null } as Run['trigger'] }, runs),
  ).toEqual(ref);
  expect(prRefOf({ ...issue, outcomes: opened.outcomes }, runs)).toEqual({
    key: 'issue:MOB-7',
    label: 'MOB-7',
    url: 'https://issues.example/MOB-7',
  });
});
test('outcomes on children and grandchildren resolve the parent PR', () => {
  expect(prRefOf(builder, runs)?.label).toBe('wardby#212');
  expect(
    prRefOf(builder, [
      ...runs.filter((r) => r.id !== child.id),
      { ...child, outcomes: [] },
      { ...child, id: 'grandchild', parentRunId: child.id },
    ])?.label,
  ).toBe('wardby#212');
});
test('manual and scheduled runs without outcomes have no reference', () => {
  expect(prRefOf({ ...opened, outcomes: [] }, runs)).toBeNull();
  expect(prRefOf(scheduled, runs)).toBeNull();
});
test('event labels cover review, mention, own and descendant outcomes, and no event', () => {
  expect([review, followUp, opened, builder, scheduled].map((r) => eventLabel(r, runs))).toEqual([
    'review',
    'follow-up',
    'opened',
    'opened',
    null,
  ]);
});
test('chains group and sort runs by newest start, sum top-level cost, and leave unrelated runs plain', () => {
  const entries = asChains([opened, scheduled, review, followUp], runs);
  expect(entries).toEqual([
    {
      kind: 'group',
      ...ref,
      runs: [followUp, review, opened],
      state: 'running',
      costUsd: expect.closeTo(1.84),
    },
    { kind: 'run', run: scheduled },
  ]);
  expect(asChains([review])).toEqual([{ kind: 'run', run: review }]);
  expect(asChains([])).toEqual([]);
  expect(
    asChains([opened, { ...scheduled, startedAt: '2026-10-01T12:00:00Z' }, review])[0].kind,
  ).toBe('run');
});
test.each(['failed', 'cancelled', 'succeeded'] as const)(
  'newest %s determines finished group state',
  (status) => {
    expect(asChains([opened, { ...followUp, status }])[0]).toMatchObject({
      state: status === 'succeeded' ? 'succeeded' : 'failed',
    });
  },
);
test('pending or running wins over the newest failure', () => {
  for (const status of ['pending', 'running'] as const)
    expect(
      asChains([
        { ...opened, status },
        { ...followUp, status: 'failed' },
      ])[0],
    ).toMatchObject({ state: 'running' });
});
