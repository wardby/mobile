import { useRouter } from 'expo-router';
import { useState } from 'react';
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

const dollars = (value: number) => `$${value.toFixed(2)}`;
const count = (value: number) => `${value} ${value === 1 ? 'run' : 'runs'}`;
export default function Spend() {
  const colors = useColors();
  const router = useRouter();
  const { period, setPeriod, ready } = useSpendPeriod();
  const { data, loading, error, refetch } = useSpend(period, ready);
  const [issuesExpanded, setIssuesExpanded] = useState(false);
  const [agentsExpanded, setAgentsExpanded] = useState(false);
  const window = periods.find((item) => item.key === period)!.window;
  const linked = data?.issues.filter((row) => row.key !== 'unlinked') ?? [];
  const unlinked = data?.issues.find((row) => row.key === 'unlinked');
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
                  setIssuesExpanded(false);
                  setAgentsExpanded(false);
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
                  Only the latest 2,000 runs are counted.
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
                    <Text className="text-xs font-semibold" style={muted}>
                      BY ISSUE
                    </Text>
                    {linked.slice(0, issuesExpanded ? undefined : 10).map((row) => (
                      <Box key={row.key} className="gap-1">
                        {row.url ? (
                          <ExternalLink
                            testID={`spend-issue-${row.key}`}
                            label={row.label}
                            url={row.url}
                          />
                        ) : (
                          <Text testID={`spend-issue-${row.key}`} style={{ color: colors.text }}>
                            {row.label}
                          </Text>
                        )}
                        <Text style={muted}>
                          {dollars(row.costUsd)} · {count(row.runs)}
                        </Text>
                      </Box>
                    ))}
                    {linked.length > 10 && (
                      <TextButton
                        testID="spend-issue-more"
                        label={issuesExpanded ? 'Show fewer' : `Show all (${linked.length})`}
                        expanded={issuesExpanded}
                        onPress={() => setIssuesExpanded(!issuesExpanded)}
                      />
                    )}
                    <Box testID="spend-issue-unlinked">
                      <Text style={{ color: colors.text }}>Not linked to an issue</Text>
                      <Text style={muted}>
                        {dollars(unlinked?.costUsd ?? 0)} · {count(unlinked?.runs ?? 0)}
                      </Text>
                    </Box>
                  </Box>
                  <Box className="gap-3">
                    <Text className="text-xs font-semibold" style={muted}>
                      BY AGENT
                    </Text>
                    {data.agents.slice(0, agentsExpanded ? undefined : 10).map((row) => (
                      <NavigationRow
                        key={row.agentId}
                        testID={`spend-agent-${row.agentId}`}
                        accessibilityLabel={`View runs by ${row.agentName}`}
                        onPress={() =>
                          router.navigate({ pathname: '/(tabs)', params: { agent: row.agentId } })
                        }
                      >
                        <Box className="flex-1 gap-2">
                          <Text style={{ color: colors.text }}>{row.agentName}</Text>
                          <Text style={muted}>
                            {dollars(row.costUsd)} · {count(row.runs)}
                          </Text>
                          <Progress
                            accessibilityLabel={`${row.agentName} relative spend`}
                            ratio={
                              data.agents[0].costUsd > 0 ? row.costUsd / data.agents[0].costUsd : 0
                            }
                            level="ok"
                            style={{ height: 4 }}
                          />
                        </Box>
                      </NavigationRow>
                    ))}
                    {data.agents.length > 10 && (
                      <TextButton
                        testID="spend-agent-more"
                        label={agentsExpanded ? 'Show fewer' : `Show all (${data.agents.length})`}
                        expanded={agentsExpanded}
                        onPress={() => setAgentsExpanded(!agentsExpanded)}
                      />
                    )}
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
