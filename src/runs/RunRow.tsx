import { Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import type { components } from '../api/schema';
import { useColors } from '../navigation/styles';
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
  const pillColors = useColorScheme() === 'dark' ? pill.dark : pill.light;
  const started = relativeTime(run.startedAt, now);
  const cost = formatCost(run.costUsd);
  let details = `${started} · ${cost} of ${formatBudget(run.budgetUsd)}`;
  if (subRuns > 0) details += ` · ${subRuns} sub-run${subRuns === 1 ? '' : 's'}`;
  return (
    <Pressable
      testID={`run-row-${run.id}`}
      accessible
      accessibilityRole="button"
      accessibilityLabel={`${run.agentName}, ${pill.label}, started ${started}, cost ${cost}`}
      style={styles.row}
      onPress={onPress}
    >
      <View style={styles.line}>
        <Text numberOfLines={1} style={[styles.name, { color: colors.text }]}>
          {run.agentName}
        </Text>
        <View
          testID={`run-status-${run.id}`}
          style={[styles.pill, { backgroundColor: pillColors.background }]}
        >
          <Text style={[styles.pillText, { color: pillColors.text }]}>{pill.label}</Text>
        </View>
      </View>
      <Text numberOfLines={1} style={[styles.details, { color: colors.muted }]}>
        {details}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { height: rowHeight, paddingHorizontal: 16, justifyContent: 'center', gap: 4 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { flex: 1, fontSize: 17, fontWeight: 'bold' },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  pillText: { fontSize: 13, fontWeight: '600' },
  details: { fontSize: 14 },
});
