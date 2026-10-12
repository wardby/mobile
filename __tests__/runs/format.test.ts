import { formatBudget, formatCost, relativeTime } from '../../src/runs/format';

test.each([
  [0, '$0.00'],
  [0.043, '$0.043'],
  [0.0432, '$0.043'],
  [0.021, '$0.021'],
  [0.4, '$0.40'],
  [0.43, '$0.43'],
  [0.0999, '$0.10'],
  [0.994, '$0.99'],
  [0.996, '$1.00'],
  [1, '$1.00'],
  [1.21, '$1.21'],
  [2.984, '$2.98'],
  [12, '$12.00'],
])('formatCost(%p) is %p', (usd, text) => {
  expect(formatCost(usd)).toBe(text);
});

test.each([
  [1, '$1'],
  [3, '$3'],
  [12, '$12'],
  [2.5, '$2.50'],
  [0.5, '$0.50'],
])('formatBudget(%p) is %p', (usd, text) => {
  expect(formatBudget(usd)).toBe(text);
});

const now = Date.parse('2026-10-01T12:00:00.000Z');
const ago = (ms: number) => new Date(now - ms).toISOString();
const s = 1000;
const m = 60 * s;
const h = 60 * m;
const d = 24 * h;

test.each([
  [0, 'just now'],
  [59 * s, 'just now'],
  [60 * s, '1m ago'],
  [3 * m + 59 * s, '3m ago'],
  [59 * m + 59 * s, '59m ago'],
  [h, '1h ago'],
  [2 * h + 30 * m, '2h ago'],
  [23 * h + 59 * m, '23h ago'],
  [d, '1d ago'],
  [3 * d + 5 * h, '3d ago'],
  [-5 * m, 'just now'],
])('relativeTime %p ms ago is %p', (ms, text) => {
  expect(relativeTime(ago(ms), now)).toBe(text);
});
