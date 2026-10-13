import { Menu } from '../../components/ui/menu';
import { timeRanges } from '../../src/runs/timeRange';
import { ButtonGroup } from '../../components/ui/button';
import { Divider } from '../../components/ui/divider';
import { Spinner } from '../../components/ui/spinner';
import { Box } from '../../components/ui/box';
import { Text } from '../../components/ui/text';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppState, FlatList, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextButton } from '../../src/ui/interactions';
import { useLiveGraph } from '../../src/live/useLiveGraph';
import { useColors } from '../../src/navigation/styles';
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
  const { graph, refresh, range, setRange } = useLiveGraph();
  const colors = useColors();
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now);
  const timeRange = timeRanges.find((item) => item.key === range)!;
  const selected = filters.find((item) => item.key === filter)!;

  const { runs, subRuns } = useMemo(() => {
    const subRuns = new Map<string, number>();
    for (const run of graph?.runs ?? [])
      if (run.parentRunId !== null)
        subRuns.set(run.parentRunId, (subRuns.get(run.parentRunId) ?? 0) + 1);
    const runs = (graph?.runs ?? [])
      .filter((run) => Date.parse(run.startedAt) > now - timeRange.duration)
      .filter((run) => run.parentRunId === null)
      .filter((run) => !selected.statuses || selected.statuses.includes(run.status))
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
    return { runs, subRuns };
  }, [graph, selected, now, timeRange]);

  // Keep the relative start times current.
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const current = Date.now();
    const expiries = (graph?.runs ?? [])
      .map((run) => Date.parse(run.startedAt) + timeRange.duration)
      .filter((expiry) => expiry > current);
    const timer = expiries.length
      ? setTimeout(() => setNow(Date.now()), Math.min(...expiries) - current)
      : null;
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => {
      if (timer !== null) clearTimeout(timer);
      listener.remove();
    };
  }, [graph, timeRange, now]);

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
      className="flex-1"
      style={[{ backgroundColor: colors.background }]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, flexShrink: 0 }}
        contentContainerStyle={{
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 8,
        }}
      >
        <ButtonGroup
          className="flex-row border rounded-lg overflow-hidden"
          style={{ borderColor: colors.muted, borderWidth: StyleSheet.hairlineWidth }}
        >
          {filters.map((item) => {
            const active = item.key === filter;
            return (
              <TextButton
                key={item.key}
                testID={`runs-filter-${item.key}`}
                label={item.label}
                selectedFill
                accessibilityState={{ selected: active }}
                className="py-2 items-center"
                onPress={() => setFilter(item.key)}
              />
            );
          })}
        </ButtonGroup>
        <Menu
          placement="bottom right"
          selectionMode="single"
          selectedKeys={new Set([range])}
          style={{ backgroundColor: colors.background, borderColor: colors.muted }}
          className="rounded-lg border p-1"
          trigger={(props, { open }) => (
            <TextButton
              {...props}
              testID="runs-range"
              label={range}
              expanded={open}
              accessibilityLabel={`Time range, ${timeRange.label.toLowerCase()}`}
              accessibilityHint="Opens the time range menu"
              style={{ width: 80 }}
            />
          )}
        >
          {timeRanges.map((item) => (
            <Menu.Item
              key={item.key}
              textValue={item.label}
              testID={`runs-range-${item.key}`}
              accessibilityLabel={item.label}
              accessibilityState={{ selected: item.key === range }}
              onPress={() => setRange(item.key)}
              className="px-3 py-2"
            >
              <Menu.ItemLabel
                className={item.key === range ? 'font-bold' : ''}
                style={{ color: colors.tint }}
              >
                {item.key === range ? '✓ ' : ''}
                {item.label}
              </Menu.ItemLabel>
            </Menu.Item>
          ))}
        </Menu>
      </ScrollView>
      {graph === null ? (
        <Box testID="runs-loading" className="flex-1 items-center justify-center gap-2 p-6">
          <Spinner accessibilityLabel="Loading runs" />
          <Text className="text-[17px]" style={[{ color: colors.muted }]}>
            Loading runs…
          </Text>
        </Box>
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
          ItemSeparatorComponent={() => <Divider className="ml-4" />}
          ListEmptyComponent={
            <Box>
              <Text
                testID="runs-empty"
                className="text-[17px] text-center p-6"
                style={[{ color: colors.muted }]}
              >
                {filter === 'all'
                  ? `No runs in the ${timeRange.window}.`
                  : `${selected.empty} (${timeRange.window})`}
              </Text>
              {range !== '7d' && (
                <TextButton
                  testID="runs-widen"
                  label={
                    range === '1h' || range === '6h' ? 'Show last 24 hours' : 'Show last 7 days'
                  }
                  onPress={() => setRange(range === '24h' ? '7d' : '24h')}
                />
              )}
            </Box>
          }
          ListFooterComponent={
            graph.truncated || graph.runs.length >= graph.limit ? (
              <Text
                testID="runs-limit"
                className="text-center p-4"
                style={{ color: colors.muted }}
              >{`Showing the latest ${graph.limit} runs from the ${timeRange.window}.`}</Text>
            ) : null
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
