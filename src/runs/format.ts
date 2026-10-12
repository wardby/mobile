// Under $1: two significant digits ($0.043). From $1 up: cents ($1.21).
export function formatCost(usd: number) {
  const rounded = Number(usd.toPrecision(2));
  if (rounded === 0) return '$0.00';
  if (rounded >= 1) return `$${usd.toFixed(2)}`;
  return `$${rounded.toFixed(Math.max(2, 1 - Math.floor(Math.log10(rounded))))}`;
}

// Budgets are usually whole dollars: "$3", otherwise as a cost.
export function formatBudget(usd: number) {
  return Number.isInteger(usd) ? `$${usd}` : formatCost(usd);
}

// "just now" under a minute, then minutes, hours and days ago.
export function relativeTime(iso: string, now: number) {
  const seconds = Math.floor((now - Date.parse(iso)) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
