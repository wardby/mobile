import { statusTokens } from '../../components/ui/theme';
import type { components } from '../api/schema';

export type RunStatus = components['schemas']['graph-snapshot']['runs'][number]['status'];
type Tone = keyof typeof statusTokens;

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
  return { label, tone, ...statusTokens[tone] };
}
