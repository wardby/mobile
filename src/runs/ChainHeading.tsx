import { Box, HStack, VStack } from '../../components/ui/box';
import { Text } from '../../components/ui/text';
import { useThemeMode } from '../../components/ui/provider';
import { useColors } from '../navigation/styles';
import { ExternalLink } from '../ui/interactions';
import { formatCost } from './format';
import type { ChainGroup } from './prChains';
import { statusStyle } from './status';

export function ChainHeading({ group }: { group: ChainGroup }) {
  const colors = useColors();
  const tone = statusStyle(group.state)[useThemeMode()];
  const state =
    group.state === 'succeeded' ? 'Done' : group.state === 'running' ? 'Running' : 'Failed';
  const cost = formatCost(group.costUsd);
  const label = `${group.key.startsWith('issue:') ? 'Issue' : 'Pull request'} ${group.label}, ${state}, ${group.runs.length} runs, ${cost}${group.url ? ', opens in browser' : ''}`;
  const contents = (
    <VStack className="flex-1 min-w-0 gap-1">
      <HStack className="items-center gap-2">
        <Text
          numberOfLines={1}
          className="flex-1 min-w-0 text-[17px] font-semibold"
          style={{ color: group.url ? colors.tint : colors.text }}
        >
          {group.label}
        </Text>
        <Box
          testID={`run-group-state-${group.key}`}
          className="rounded-[10px] px-2 py-0.5"
          style={{ backgroundColor: tone.background }}
        >
          <Text className="text-[13px] font-semibold" style={{ color: tone.text }}>
            {state}
          </Text>
        </Box>
      </HStack>
      <Text numberOfLines={1} className="text-[14px]" style={{ color: colors.muted }}>
        {group.runs.length} runs · {cost}
      </Text>
    </VStack>
  );
  return group.url ? (
    <Box accessibilityRole="header">
      <ExternalLink
        testID={`run-group-${group.key}`}
        label={group.label}
        url={group.url}
        accessibilityLabel={label}
        className="px-4 py-3 min-h-11"
      >
        {contents}
      </ExternalLink>
    </Box>
  ) : (
    <Box
      testID={`run-group-${group.key}`}
      accessible
      accessibilityRole="header"
      accessibilityLabel={label}
      className="px-4 py-3 min-h-11"
    >
      {contents}
    </Box>
  );
}
