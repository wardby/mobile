import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextButton } from '../../src/ui/interactions';
import { useLiveGraph } from '../../src/live/useLiveGraph';
import { styles as shared, useColors } from '../../src/navigation/styles';
import { rowHeight, RunRow } from '../../src/runs/RunRow';
import type { RunStatus } from '../../src/runs/status';

type Filter = 'all' | 'running' | 'failed';

const filters: { key: Filter; label: string; empty: string; statuses?: RunStatus[] }[] = [
  { key: 'all', label: 'All', empty: 'No runs in the last day.' },
  { key: 'running', label: 'Running', empty: 'Nothing running.', statuses: ['pending', 'running'] },
  {
    key: 'failed',
    label: 'Failed',
    empty: 'No failures. 🎉',
    statuses: ['failed', 'lost', 'budget_exhausted', 'refused'],
  },
];

export default function Runs() {
  const { graph, refresh } = useLiveGraph();
  const colors = useColors();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now);
  const selected = filters.find((item) => item.key === filter)!;

  const { runs, subRuns } = useMemo(() => {
    const subRuns = new Map<string, number>();
    for (const run of graph?.runs ?? [])
      if (run.parentRunId !== null)
        subRuns.set(run.parentRunId, (subRuns.get(run.parentRunId) ?? 0) + 1);
    const runs = (graph?.runs ?? [])
      .filter((run) => run.parentRunId === null)
      .filter((run) => !selected.statuses || selected.statuses.includes(run.status))
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
    return { runs, subRuns };
  }, [graph, selected]);

  // Keep the relative start times current.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  async function onRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <SafeAreaView
      edges={['left', 'right']}
      style={[shared.screen, { backgroundColor: colors.background }]}
    >
      <View style={[styles.segments, { borderColor: colors.muted }]}>
        {filters.map((item) => {
          const active = item.key === filter;
          return (
            <TextButton
              key={item.key}
              testID={`runs-filter-${item.key}`}
              label={item.label}
              accessibilityState={{ selected: active }}
              style={styles.segment}
              onPress={() => setFilter(item.key)}
            />
          );
        })}
      </View>
      {graph === null ? (
        <View testID="runs-loading" style={shared.placeholder}>
          <ActivityIndicator accessibilityLabel="Loading runs" />
          <Text style={[shared.text, { color: colors.muted }]}>Loading runs…</Text>
        </View>
      ) : (
        <FlatList
          testID="runs-list"
          data={runs}
          keyExtractor={(run) => run.id}
          getItemLayout={(_, index) => ({ length: rowHeight, offset: rowHeight * index, index })}
          renderItem={({ item }) => (
            <RunRow
              run={item}
              subRuns={subRuns.get(item.id) ?? 0}
              now={now}
              onPress={() => router.push({ pathname: '/runs/[id]', params: { id: item.id } })}
            />
          )}
          ItemSeparatorComponent={() => (
            <View style={[styles.separator, { backgroundColor: colors.muted }]} />
          )}
          ListEmptyComponent={
            <Text testID="runs-empty" style={[shared.text, styles.empty, { color: colors.muted }]}>
              {selected.empty}
            </Text>
          }
          refreshControl={
            <RefreshControl
              accessibilityLabel="Refresh runs"
              refreshing={refreshing}
              onRefresh={onRefresh}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  segments: {
    flexDirection: 'row',
    margin: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    overflow: 'hidden',
  },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 16 },
  empty: { textAlign: 'center', padding: 24 },
});
