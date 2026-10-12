import type { components } from '../api/schema';

export type RunStatus = components['schemas']['graph-snapshot']['runs'][number]['status'];
type PillColors = { background: string; text: string };
type Tone = 'blue' | 'green' | 'red' | 'orange' | 'grey';

// Tinted background with strong text, tuned separately for light and dark mode.
const tones: Record<Tone, { light: PillColors; dark: PillColors }> = {
  blue: {
    light: { background: '#dbeafe', text: '#1e40af' },
    dark: { background: '#1e3a5f', text: '#93c5fd' },
  },
  green: {
    light: { background: '#dcfce7', text: '#166534' },
    dark: { background: '#14532d', text: '#86efac' },
  },
  red: {
    light: { background: '#fee2e2', text: '#991b1b' },
    dark: { background: '#7f1d1d', text: '#fca5a5' },
  },
  orange: {
    light: { background: '#ffedd5', text: '#9a3412' },
    dark: { background: '#7c2d12', text: '#fdba74' },
  },
  grey: {
    light: { background: '#e5e7eb', text: '#374151' },
    dark: { background: '#374151', text: '#d1d5db' },
  },
};

const statuses: Record<RunStatus, { label: string; tone: Tone }> = {
  running: { label: 'Running', tone: 'blue' },
  pending: { label: 'Queued', tone: 'blue' },
  succeeded: { label: 'Succeeded', tone: 'green' },
  failed: { label: 'Failed', tone: 'red' },
  lost: { label: 'Lost', tone: 'red' },
  budget_exhausted: { label: 'Out of budget', tone: 'orange' },
  refused: { label: 'Refused', tone: 'orange' },
  cancelled: { label: 'Cancelled', tone: 'grey' },
};

export function statusStyle(status: RunStatus) {
  const { label, tone } = statuses[status];
  return { label, tone, ...tones[tone] };
}
