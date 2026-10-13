export const timeRanges = [
  { key: '1h', label: 'Last hour', window: 'last hour', duration: 3600000 },
  { key: '6h', label: 'Last 6 hours', window: 'last 6 hours', duration: 21600000 },
  { key: '24h', label: 'Last 24 hours', window: 'last 24 hours', duration: 86400000 },
  { key: '7d', label: 'Last 7 days', window: 'last 7 days', duration: 604800000 },
] as const;
export type TimeRange = (typeof timeRanges)[number]['key'];
export function isTimeRange(value: unknown): value is TimeRange {
  return timeRanges.some((range) => range.key === value);
}
