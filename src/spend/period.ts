export type Period = 'day' | 'week' | 'month';
export const periods: { key: Period; label: string; window: string }[] = [
  { key: 'day', label: 'Today', window: 'today' },
  { key: 'week', label: 'This week', window: 'this week' },
  { key: 'month', label: 'This month', window: 'this month' },
];
export function periodStart(period: Period, now: Date): Date {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (period === 'week') start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  if (period === 'month') start.setUTCDate(1);
  return start;
}
export function periodEnd(period: Period, now: Date): Date {
  const end = periodStart(period, now);
  if (period === 'month') end.setUTCMonth(end.getUTCMonth() + 1);
  else end.setUTCDate(end.getUTCDate() + (period === 'week' ? 7 : 1));
  return end;
}
export function resetLabel(period: Period, now: Date, timeZone?: string): string {
  const end = periodEnd(period, now);
  const time = end
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone })
    .toLowerCase();
  const day =
    period === 'day' ? '' : end.toLocaleDateString('en-US', { weekday: 'short', timeZone }) + ' ';
  return `Resets ${day}${time}`;
}
