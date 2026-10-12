import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLiveGraph } from '../../src/live/useLiveGraph';
import { styles, useColors } from '../../src/navigation/styles';
import { LiveIndicator } from '../../src/runs/LiveIndicator';
import { MarkdownResult } from '../../src/runs/MarkdownResult';
import { RunRow } from '../../src/runs/RunRow';
import {
  formatCost,
  formatCount,
  formatDuration,
  relativeTime,
  spendLevel,
} from '../../src/runs/format';
import { statusStyle } from '../../src/runs/status';
import { useRunDetail } from '../../src/runs/useRunDetail';

export default function RunDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RunDetailContent key={id} id={id} />;
}

function RunDetailContent({ id }: { id: string }) {
  const { run, loading, error, refetch } = useRunDetail(id);
  const { graph } = useLiveGraph();
  const colors = useColors();
  const dark = useColorScheme() === 'dark';
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (run?.status !== 'running' || run.finishedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [run?.status, run?.finishedAt]);
  const back = () => router.replace('/');
  const textStyle = [styles.text, { color: colors.text }];
  const button = (label: string, testID: string, onPress: () => void) => (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.button}
    >
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
  const section = (label: string, testID: string, children: ReactNode) => (
    <View testID={testID} style={styles.section}>
      <Text accessibilityRole="header" style={[styles.label, { color: colors.muted }]}>
        {label}
      </Text>
      {children}
    </View>
  );
  const header = (
    <Stack.Screen
      options={{
        title: run?.agentName ?? 'Run',
        headerRight: () => <LiveIndicator />,
        headerLeft: () => (
          <Pressable
            testID="run-detail-header-back"
            accessibilityLabel="Back to Runs"
            accessibilityRole="button"
            onPress={() => (router.canGoBack() ? router.back() : back())}
          >
            <Text style={textStyle}>‹ Runs</Text>
          </Pressable>
        ),
      }}
    />
  );
  if (!run || error)
    return (
      <SafeAreaView
        edges={['left', 'right', 'bottom']}
        style={[styles.placeholder, { backgroundColor: colors.background }]}
      >
        {header}
        {loading ? (
          <View testID="run-detail-loading" style={local.center}>
            <ActivityIndicator />
            <Text style={textStyle}>Loading run…</Text>
          </View>
        ) : error?.code === 'not_found' ? (
          <View testID="run-detail-not-found" style={local.center}>
            <Text style={textStyle}>{"This run isn't available any more."}</Text>
            {button('Back to runs', 'run-detail-back', back)}
          </View>
        ) : (
          <View style={local.center}>
            <Text style={textStyle}>{"Couldn't load this run."}</Text>
            {button('Retry', 'run-detail-retry', () => void refetch())}
          </View>
        )}
      </SafeAreaView>
    );
  const pill = statusStyle(run.status);
  const tone = dark ? pill.dark : pill.light;
  const cost = formatCost(run.costUsd);
  const budget = formatCost(run.budgetUsd);
  const level = spendLevel(run.costUsd, run.budgetUsd, run.status);
  const ratio =
    run.budgetUsd > 0
      ? Math.min(1, Math.max(0, run.costUsd / run.budgetUsd))
      : run.costUsd > 0
        ? 1
        : 0;
  const children = graph?.runs.filter((child) => child.parentRunId === id) ?? [];
  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      {header}
      <ScrollView
        testID="run-detail"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            testID="run-detail-refresh"
            accessibilityLabel="Refresh run"
            refreshing={loading}
            onRefresh={() => void refetch()}
          />
        }
      >
        <View style={styles.section}>
          <View
            testID="run-detail-status"
            style={[local.pill, { backgroundColor: tone.background }]}
          >
            <Text style={[local.status, { color: tone.text }]}>{pill.label}</Text>
          </View>
          <Text testID="run-detail-elapsed" style={[styles.text, { color: colors.muted }]}>
            Started {relativeTime(run.startedAt, now)}
            {run.finishedAt
              ? ` · Took ${formatDuration(Date.parse(run.finishedAt) - Date.parse(run.startedAt))}`
              : run.status === 'running'
                ? ` · Running for ${formatDuration(now - Date.parse(run.startedAt))}`
                : ''}
          </Text>
          <Text style={textStyle}>
            {run.model}
            {run.coding
              ? ` · ${run.codingProvider === 'claude' ? 'claude-code' : (run.codingProvider ?? run.coding.provider)}`
              : ''}
          </Text>
        </View>
        {section(
          'SPEND',
          'run-detail-spend',
          <>
            <Text style={textStyle}>
              {cost} of {budget}
            </Text>
            <View
              testID="run-detail-spend-bar"
              accessible
              accessibilityRole="progressbar"
              accessibilityLabel={`Spent ${cost} of ${budget}`}
              accessibilityValue={{ min: 0, max: run.budgetUsd, now: run.costUsd }}
              style={[local.bar, { backgroundColor: dark ? '#374151' : '#e5e7eb' }]}
            >
              <View
                style={[
                  local.fill,
                  {
                    width: `${ratio * 100}%`,
                    backgroundColor:
                      level === 'over' ? '#ff3b30' : level === 'warn' ? '#ff9f0a' : '#34c759',
                  },
                ]}
              />
            </View>
            <Text testID="run-detail-tokens" style={textStyle}>
              {run.turns} turns · {formatCount(run.tokensIn)} in · {formatCount(run.tokensOut)} out
            </Text>
          </>,
        )}
        {run.coding &&
          section(
            'CODE',
            'run-detail-code',
            <>
              <Text style={textStyle}>{run.coding.repository}</Text>
              <Text style={textStyle}>
                {run.coding.baseRef} → {run.coding.headRef}
              </Text>
              {run.coding.failureCategory && (
                <Text style={[styles.text, { color: colors.destructive }]}>
                  {run.coding.failureCategory}
                </Text>
              )}
            </>,
          )}
        {section(
          'OUTCOMES',
          'run-detail-outcomes',
          run.outcomes.length ? (
            run.outcomes.map((outcome, index) => {
              const url =
                outcome.kind === 'pull_request' || outcome.kind === 'issue_comment'
                  ? outcome.url
                  : null;
              const label =
                outcome.kind === 'pull_request'
                  ? `PR #${outcome.number} · ${outcome.state ?? 'unknown'}`
                  : outcome.kind === 'issue_comment'
                    ? `Issue comment · ${outcome.issueKey}`
                    : outcome.kind === 'code_host_comment'
                      ? `Code-host comment · ${outcome.repository} #${outcome.number}`
                      : `Check · ${outcome.repository}${outcome.number === null ? '' : ` #${outcome.number}`} · ${outcome.completed ? 'completed' : 'pending'}`;
              const accessibleLabel =
                outcome.kind === 'pull_request'
                  ? `Pull request ${outcome.number}, ${outcome.state ?? 'unknown'}`
                  : label;
              const props = {
                testID: `run-outcome-${index}`,
                accessible: true,
                accessibilityLabel: `${accessibleLabel}${url ? ', opens in browser' : ''}`,
                style: local.outcome,
              };
              return url ? (
                <Pressable
                  key={index}
                  {...props}
                  accessibilityRole="link"
                  onPress={() => {
                    void Linking.openURL(url).catch(() => {});
                  }}
                >
                  <Text style={textStyle}>{label} ›</Text>
                </Pressable>
              ) : (
                <View key={index} {...props}>
                  <Text style={textStyle}>{label}</Text>
                </View>
              );
            })
          ) : (
            <Text style={textStyle}>No outcomes yet.</Text>
          ),
        )}
        {section(
          'SUB-RUNS',
          'run-detail-subruns',
          children.length ? (
            children.map((child) => (
              <RunRow
                key={child.id}
                run={child}
                subRuns={
                  graph?.runs.filter((candidate) => candidate.parentRunId === child.id).length ?? 0
                }
                now={now}
                onPress={() => router.push(`/runs/${child.id}`)}
              />
            ))
          ) : (
            <Text style={textStyle}>(none)</Text>
          ),
        )}
        {run.finishedAt &&
          run.finalText &&
          section(
            'RESULT',
            'run-detail-result',
            <MarkdownResult key={run.id} text={run.finalText} />,
          )}
        {run.status === 'failed' &&
          run.error &&
          section(
            'ERROR',
            'run-detail-error',
            <Text style={[styles.text, { color: colors.destructive }]}>{run.error}</Text>,
          )}
      </ScrollView>
    </SafeAreaView>
  );
}

const local = StyleSheet.create({
  center: { alignItems: 'center', gap: 16 },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  status: { fontSize: 20, fontWeight: '600' },
  bar: { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%' },
  outcome: { paddingVertical: 12 },
});
