import { Menu } from '../../components/ui/menu';
import { timeRanges } from '../../src/runs/timeRange';
import { agentOptions, matchesAgent } from '../../src/runs/agentFilter';
import { Divider } from '../../components/ui/divider';
import { Spinner } from '../../components/ui/spinner';
import { Box } from '../../components/ui/box';
import { Text } from '../../components/ui/text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppState, FlatList, RefreshControl } from 'react-native';
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
  const { agent: agentParam } = useLocalSearchParams<{ agent?: string }>();
  const [agentSelection, setAgentSelection] = useState({
    param: agentParam,
    agentId: agentParam || null,
    agentName: undefined as string | undefined,
  });
  const agentName =
    graph?.runs.find((run) => run.agentId === agentSelection.agentId)?.agentName ??
    agentSelection.agentName;
  const selectedAgent = agentName === undefined ? null : agentSelection.agentId;
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [now, setNow] = useState(Date.now);
  const timeRange = timeRanges.find((item) => item.key === range)!;
  const options = agentOptions(graph?.runs ?? [], now - timeRange.duration);
  if (selectedAgent && !options.some((item) => item.agentId === selectedAgent)) {
    options.push({ agentId: selectedAgent, agentName: agentName!, runs: 0 });
    options.sort(
      (a, b) =>
        a.agentName.toLowerCase().localeCompare(b.agentName.toLowerCase()) ||
        a.agentId.localeCompare(b.agentId),
    );
  }
  // Route changes replace local choices; remember the name when a graph window drops the agent.
  if (agentSelection.param !== agentParam) {
    setAgentSelection({ param: agentParam, agentId: agentParam || null, agentName: undefined });
    setFilter('all');
  } else if (agentName !== agentSelection.agentName) {
    setAgentSelection({ ...agentSelection, agentName });
  }
  const selected = filters.find((item) => item.key === filter)!;

  const { runs, subRuns } = useMemo(() => {
    const subRuns = new Map<string, number>();
    for (const run of graph?.runs ?? [])
      if (run.parentRunId !== null)
        subRuns.set(run.parentRunId, (subRuns.get(run.parentRunId) ?? 0) + 1);
    const runs = (graph?.runs ?? [])
      .filter((run) => Date.parse(run.startedAt) > now - timeRange.duration)
      .filter((run) => run.parentRunId === null)
      .filter((run) => matchesAgent(run, selectedAgent))
      .filter((run) => !selected.statuses || selected.statuses.includes(run.status))
      .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
    return { runs, subRuns };
  }, [graph, selected, selectedAgent, now, timeRange]);

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
      <Box className="flex-row items-center gap-2 px-4 py-3">
        <Menu
          placement="bottom left"
          selectionMode="single"
          selectedKeys={new Set([selectedAgent ?? 'all'])}
          style={{ backgroundColor: colors.background, borderColor: colors.muted }}
          className="rounded-lg border p-1"
          trigger={(props, { open }) => (
            <TextButton
              {...props}
              testID="runs-agent"
              label={agentName ?? 'All agents'}
              expanded={open}
              numberOfLines={1}
              accessibilityLabel={`Agent, ${agentName ?? 'All agents'}`}
              accessibilityHint="Opens the agent menu"
              className="flex-1 min-w-0"
            />
          )}
        >
          {[{ agentId: null, agentName: 'All agents', runs: 0 }, ...options].map((item) => {
            const active = item.agentId === selectedAgent;
            const label =
              item.agentId === null ? item.agentName : `${item.agentName} · ${item.runs}`;
            return (
              <Menu.Item
                key={item.agentId ?? 'all'}
                textValue={label}
                testID={`runs-agent-${item.agentId ?? 'all'}`}
                accessibilityLabel={label}
                accessibilityState={{ selected: active }}
                onPress={() =>
                  setAgentSelection({
                    param: agentParam,
                    agentId: item.agentId,
                    agentName: item.agentId === null ? undefined : item.agentName,
                  })
                }
                className="px-3 py-2"
              >
                <Menu.ItemLabel
                  className={active ? 'font-bold' : ''}
                  style={{ color: colors.tint }}
                >
                  {active ? '✓ ' : ''}
                  {label}
                </Menu.ItemLabel>
              </Menu.Item>
            );
          })}
        </Menu>
        <Menu
          placement="bottom right"
          selectionMode="single"
          selectedKeys={new Set([filter])}
          style={{ backgroundColor: colors.background, borderColor: colors.muted }}
          className="rounded-lg border p-1"
          trigger={(props, { open }) => (
            <TextButton
              {...props}
              testID="runs-filter"
              label={selected.label}
              expanded={open}
              accessibilityLabel={`Status, ${selected.label}`}
              accessibilityHint="Opens the status menu"
              style={{ width: 104 }}
            />
          )}
        >
          {filters.map((item) => (
            <Menu.Item
              key={item.key}
              textValue={item.label}
              testID={`runs-filter-${item.key}`}
              accessibilityLabel={item.label}
              accessibilityState={{ selected: item.key === filter }}
              onPress={() => setFilter(item.key)}
              className="px-3 py-2"
            >
              <Menu.ItemLabel
                className={item.key === filter ? 'font-bold' : ''}
                style={{ color: colors.tint }}
              >
                {item.key === filter ? '✓ ' : ''}
                {item.label}
              </Menu.ItemLabel>
            </Menu.Item>
          ))}
        </Menu>
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
      </Box>
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
                  ? selectedAgent
                    ? `No runs by ${agentName} in the ${timeRange.window}.`
                    : `No runs in the ${timeRange.window}.`
                  : `${selected.empty} (${selectedAgent ? `${agentName}, ` : ''}${timeRange.window})`}
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
