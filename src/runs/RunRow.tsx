import { Badge } from '../../components/ui/badge';
import { HStack, VStack } from '../../components/ui/box';
import { Text } from '../../components/ui/text';

import type { components } from '../api/schema';
import { useColors } from '../navigation/styles';
import { NavigationRow } from '../ui/interactions';
import { formatBudget, formatCost, relativeTime } from './format';
import { statusStyle } from './status';

type Run = components['schemas']['graph-snapshot']['runs'][number];

export const rowHeight = 64;

export function RunRow({
  run,
  subRuns,
  now,
  onPress,
}: {
  run: Run;
  subRuns: number;
  now: number;
  onPress: () => void;
}) {
  const colors = useColors();
  const pill = statusStyle(run.status);

  const started = relativeTime(run.startedAt, now);
  const cost = formatCost(run.costUsd);
  let details = `${started} · ${cost} of ${formatBudget(run.budgetUsd)}`;
  if (subRuns > 0) details += ` · ${subRuns} sub-run${subRuns === 1 ? '' : 's'}`;
  return (
    <NavigationRow
      testID={`run-row-${run.id}`}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${run.agentName}, ${pill.label}, started ${started}, cost ${cost}`}
      className="h-16 px-4"
      onPress={onPress}
    >
      <VStack className="flex-1 gap-1">
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
        <Text numberOfLines={1} className="text-[14px]" style={[{ color: colors.muted }]}>
          {details}
        </Text>
      </VStack>
    </NavigationRow>
  );
}
