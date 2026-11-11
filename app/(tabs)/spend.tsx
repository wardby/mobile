import { useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Box } from '../../components/ui/box';
import { Text } from '../../components/ui/text';
import { ButtonGroup } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Spinner } from '../../components/ui/spinner';
import { ExternalLink, NavigationRow, TextButton } from '../../src/ui/interactions';
import { useColors } from '../../src/navigation/styles';
import { spendLevel } from '../../src/runs/format';
import { periods, resetLabel } from '../../src/spend/period';
import { useSpend, useSpendPeriod } from '../../src/spend/useSpend';
import type { AgentRow, IssueRow } from '../../src/spend/helpers';

const dollars = (value: number) => `$${value.toFixed(2)}`;
const count = (value: number) => `${value} ${value === 1 ? 'run' : 'runs'}`;
// Repeated taps must replace local Runs filters, even for the same agent.
let agentNavigation = 0;
const PREVIEW = 10;
const PAGE = 50;
// Memoized rows: paging re-renders only the newly shown rows, not the whole list.
const IssueItem = memo(function IssueItem({ row }: { row: IssueRow }) {
  const colors = useColors();
  return (
    <Box className="gap-1">
      {row.url ? (
        <ExternalLink testID={`spend-issue-${row.key}`} label={row.label} url={row.url} />
      ) : (
        <Text testID={`spend-issue-${row.key}`} style={{ color: colors.text }}>
          {row.label}
        </Text>
      )}
      <Text style={{ color: colors.muted }}>
        {dollars(row.costUsd)} · {count(row.runs)}
      </Text>
    </Box>
  );
});
const AgentItem = memo(function AgentItem({
  row,
  topUsd,
  onPress,
}: {
  row: AgentRow;
  topUsd: number;
  onPress: (agentId: string) => void;
}) {
  const colors = useColors();
  return (
    <NavigationRow
      testID={`spend-agent-${row.agentId}`}
      accessibilityLabel={`View runs by ${row.agentName}`}
      onPress={() => onPress(row.agentId)}
    >
      <Box className="flex-1 gap-2">
        <Text style={{ color: colors.text }}>{row.agentName}</Text>
        <Text style={{ color: colors.muted }}>
          {dollars(row.costUsd)} · {count(row.runs)}
        </Text>
        <Progress
          accessibilityLabel={`${row.agentName} relative spend`}
          ratio={topUsd > 0 ? row.costUsd / topUsd : 0}
          level="ok"
          style={{ height: 4 }}
        />
      </Box>
    </NavigationRow>
  );
});
function Heading({ label, partial, testID }: { label: string; partial: boolean; testID: string }) {
  const colors = useColors();
  return (
    <Box className="flex-row items-center gap-2">
      <Text className="text-xs font-semibold" style={{ color: colors.muted }}>
        {label}
      </Text>
      {partial && (
        <Text testID={testID} className="text-xs" style={{ color: colors.muted }}>
          Partial
        </Text>
      )}
    </Box>
  );
}
function Paging({
  noun,
  total,
  shown,
  setShown,
}: {
  noun: 'issue' | 'agent';
  total: number;
  shown: number;
  setShown: (shown: number) => void;
}) {
  return (
    <>
      {shown < total && (
        <TextButton
          testID={`spend-${noun}-more`}
          label={`Show ${PAGE} more`}
          accessibilityLabel={`Show ${PAGE} more ${noun}s (${total} total)`}
          onPress={() => setShown(Math.min(shown + PAGE, total))}
        />
      )}
      {shown > PREVIEW && (
        <TextButton
          testID={`spend-${noun}-fewer`}
          label="Show fewer"
          accessibilityLabel={`Show only the top ${PREVIEW} ${noun}s`}
          onPress={() => setShown(PREVIEW)}
        />
      )}
    </>
  );
}
export default function Spend() {
  const colors = useColors();
  const router = useRouter();
  const { period, setPeriod, ready } = useSpendPeriod();
  const { data, loading, error, refetch } = useSpend(period, ready);
  const [issuesShown, setIssuesShown] = useState(PREVIEW);
  const [agentsShown, setAgentsShown] = useState(PREVIEW);
  const window = periods.find((item) => item.key === period)!.window;
  const issues = data?.issues;
  const linked = useMemo(() => issues?.filter((row) => row.key !== 'unlinked') ?? [], [issues]);
  const unlinked = useMemo(() => issues?.find((row) => row.key === 'unlinked'), [issues]);
  const openAgent = useCallback(
    (agentId: string) =>
      router.navigate({
        pathname: '/(tabs)',
        params: { agent: agentId, agentNavigation: String(++agentNavigation) },
      }),
    [router],
  );
  const muted = { color: colors.muted };
  return (
    <SafeAreaView
      edges={['left', 'right']}
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <ScrollView
        testID="spend-scroll"
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl
            testID="spend-refresh"
            accessibilityLabel="Refresh spend"
            refreshing={loading && data !== null}
            onRefresh={refetch}
          />
        }
      >
        <Box className="p-4 gap-3">
          <ButtonGroup
            className="flex-row border rounded-lg overflow-hidden"
            style={{ borderColor: colors.muted }}
          >
            {periods.map((item) => (
              <TextButton
                key={item.key}
                testID={`spend-period-${item.key}`}
                label={item.label}
                selectedFill
                accessibilityState={{ selected: period === item.key }}
                className="flex-1"
                onPress={() => {
                  setIssuesShown(PREVIEW);
                  setAgentsShown(PREVIEW);
                  setPeriod(item.key);
                }}
              />
            ))}
          </ButtonGroup>
          <Text testID="spend-resets" style={muted}>
            {resetLabel(period, new Date())}
          </Text>
        </Box>
        {error ? (
          <Box testID="spend-error" className="p-6 items-center gap-2">
            <Text style={muted}>Couldn&apos;t load spend.</Text>
            <TextButton testID="spend-retry" label="Retry" onPress={refetch} />
          </Box>
        ) : loading && !data ? (
          <Box testID="spend-loading" className="flex-1 items-center justify-center gap-2 p-6">
            <Spinner accessibilityLabel="Loading spend" />
            <Text style={muted}>Loading spend…</Text>
          </Box>
        ) : (
          data && (
            <Box className="p-4 gap-4">
              {data.runs === 0 ? (
                <Text testID="spend-empty" style={muted}>
                  No spend {window}.
                </Text>
              ) : (
                <Box>
                  <Text
                    testID="spend-total"
                    className="text-4xl font-bold"
                    style={{ color: colors.text }}
                  >
                    {data.truncated ? '≥ ' : ''}
                    {dollars(data.totalUsd)}
                  </Text>
                  <Text style={muted}>
                    {count(data.runs)} {window}
                  </Text>
                </Box>
              )}
              {data.truncated && (
                <Text testID="spend-truncated" style={muted}>
                  Only the latest 2,000 runs are counted. Totals and breakdowns may be low.
                </Text>
              )}
              {period === 'day' && data.groups.length > 0 && (
                <Box className="gap-3">
                  <Text className="text-xs font-semibold" style={muted}>
                    BUDGETS
                  </Text>
                  {data.groups.map((group) => (
                    <Box key={group.id} testID={`spend-budget-${group.id}`} className="gap-2">
                      <Text style={{ color: colors.text }}>{group.name}</Text>
                      <Text style={muted}>
                        {dollars(group.spentTodayUsd)}
                        {group.dailyBudgetUsd === null
                          ? ' today · no daily cap'
                          : ` of $${group.dailyBudgetUsd} today`}
                      </Text>
                      {group.dailyBudgetUsd !== null && (
                        <Progress
                          testID={`spend-budget-${group.id}-bar`}
                          accessibilityLabel={`${group.name} daily budget`}
                          ratio={
                            group.dailyBudgetUsd > 0
                              ? group.spentTodayUsd / group.dailyBudgetUsd
                              : group.spentTodayUsd > 0
                                ? 1
                                : 0
                          }
                          level={spendLevel(group.spentTodayUsd, group.dailyBudgetUsd, '')}
                        />
                      )}
                    </Box>
                  ))}
                </Box>
              )}
              {data.runs > 0 && (
                <>
                  <Box className="gap-3">
                    <Heading
                      label="BY ISSUE"
                      partial={data.truncated}
                      testID="spend-issue-partial"
                    />
                    {linked.slice(0, issuesShown).map((row) => (
                      <IssueItem key={row.key} row={row} />
                    ))}
                    <Paging
                      noun="issue"
                      total={linked.length}
                      shown={Math.min(issuesShown, linked.length)}
                      setShown={setIssuesShown}
                    />
                    <Box testID="spend-issue-unlinked">
                      <Text style={{ color: colors.text }}>Not linked to an issue</Text>
                      <Text style={muted}>
                        {dollars(unlinked?.costUsd ?? 0)} · {count(unlinked?.runs ?? 0)}
                      </Text>
                    </Box>
                  </Box>
                  <Box className="gap-3">
                    <Heading
                      label="BY AGENT"
                      partial={data.truncated}
                      testID="spend-agent-partial"
                    />
                    {data.agents.slice(0, agentsShown).map((row) => (
                      <AgentItem
                        key={row.agentId}
                        row={row}
                        topUsd={data.agents[0].costUsd}
                        onPress={openAgent}
                      />
                    ))}
                    <Paging
                      noun="agent"
                      total={data.agents.length}
                      shown={Math.min(agentsShown, data.agents.length)}
                      setShown={setAgentsShown}
                    />
                  </Box>
                </>
              )}
            </Box>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
