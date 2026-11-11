import type { RunStep } from '../api/stepsOf';
import { statusStyle } from './status';

export type StepTone = ReturnType<typeof statusStyle>['tone'] | 'muted';

// A step's status is "ok", "error", "exit N", or null while pending (#77).
export function stepStatus(step: RunStep): { glyph: string; label: string; tone: StepTone } {
  if (step.kind === 'said') return { glyph: '', label: 'Agent said', tone: 'muted' };
  const { status } = step;
  if (status === null) return { glyph: '…', label: 'in progress', tone: 'muted' };
  if (status === 'ok')
    return { glyph: '✓', label: 'succeeded', tone: statusStyle('succeeded').tone };
  if (status === 'error') return { glyph: '✕', label: 'failed', tone: statusStyle('failed').tone };
  const exit = /^exit (-?\d+)$/.exec(status);
  if (exit) {
    return {
      glyph: status,
      label: `exited with code ${exit[1]}`,
      tone: statusStyle('failed').tone,
    };
  }
  return { glyph: '', label: status, tone: 'muted' };
}

export function stepText(step: RunStep) {
  return step.tool === null ? step.summary : `${step.tool}: ${step.summary}`;
}

export function stepLabel(step: RunStep) {
  const { label } = stepStatus(step);
  return step.kind === 'said' ? `${label}: ${stepText(step)}` : `${stepText(step)}, ${label}`;
}
