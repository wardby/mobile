import { memo } from 'react';
import { Badge } from '../../components/ui/badge';
import { HStack, VStack } from '../../components/ui/box';
import { useThemeMode } from '../../components/ui/provider';
import { Text } from '../../components/ui/text';
import { statusTokens } from '../../components/ui/theme';

import type { components } from '../api/schema';
import type { RunStep } from '../api/stepsOf';
import { useLatestStep } from '../live/useRunSteps';
import { useColors } from '../navigation/styles';
import { NavigationRow } from '../ui/interactions';
import { formatBudget, formatCost, relativeTime } from './format';
import { statusStyle } from './status';
import { stepLabel, stepStatus, stepText } from './steps';

type Run = components['schemas']['graph-snapshot']['runs'][number];

export const rowHeight = 64;

type RunRowProps = {
  event?: string | null;
  referenceLabel?: string;
  run: Run;
  subRuns: number;
  now: number;
  onPress: () => void;
  latestStep?: RunStep | null;
};

export const RunRow = memo(function RunRow({
  run,
  subRuns,
  now,
  onPress,
  event = null,
  referenceLabel,
  latestStep = null,
}: RunRowProps) {
  const colors = useColors();
  const mode = useThemeMode();
  const pill = statusStyle(run.status);

  const started = relativeTime(run.startedAt, now);
  const cost = formatCost(run.costUsd);
  let details = `${started} · ${cost} of ${formatBudget(run.budgetUsd)}`;
  if (subRuns > 0) details += ` · ${subRuns} sub-run${subRuns === 1 ? '' : 's'}`;
  if (referenceLabel) details += ` · ${referenceLabel}${event ? ` ${event}` : ''}`;
  else if (event) details += ` · ${event}`;
  // While running, the latest step takes the details line; it returns when the run ends.
  const step = run.status === 'running' ? latestStep : null;
  let label = `${run.agentName}, ${pill.label}, started ${started}, cost ${cost}${event ? `, ${event}` : ''}`;
  if (step) label += `, now: ${stepLabel(step)}`;
  const status = step ? stepStatus(step) : null;
  return (
    <NavigationRow
      testID={`run-row-${run.id}`}
      accessible
      accessibilityRole="button"
      accessibilityLabel={label}
      className="h-16 px-4"
      onPress={onPress}
    >
      <VStack className="flex-1 min-w-0 gap-1">
        <HStack className="items-center gap-2">
          <Text
            numberOfLines={1}
            className="flex-1 text-[17px] font-bold"
            style={[{ color: colors.text }]}
          >
            {run.agentName}
          </Text>
          <Badge testID={`run-status-${run.id}`} status={run.status} />
        </HStack>
        {step && status ? (
          // Server text: plain text only, never Markdown or a link.
          <Text
            testID={`run-latest-step-${run.id}`}
            numberOfLines={1}
            ellipsizeMode="tail"
            className="text-[14px]"
            style={
              step.kind === 'said'
                ? { color: colors.muted, fontStyle: 'italic' }
                : { color: colors.muted }
            }
          >
            {status.glyph ? (
              <Text
                className="font-semibold"
                style={{
                  color:
                    status.tone === 'muted' ? colors.muted : statusTokens[status.tone][mode].text,
                }}
              >
                {`${status.glyph} `}
              </Text>
            ) : null}
            {step.kind === 'said' ? `"${stepText(step)}"` : stepText(step)}
          </Text>
        ) : (
          <Text numberOfLines={1} className="text-[14px]" style={[{ color: colors.muted }]}>
            {details}
          </Text>
        )}
      </VStack>
    </NavigationRow>
  );
});

// A RunRow that shows the run's latest live step; only this row re-renders on a step.
export function LatestStepRunRow(props: Omit<RunRowProps, 'latestStep'>) {
  const latestStep = useLatestStep(props.run.id);
  return <RunRow {...props} latestStep={latestStep} />;
}
