import { Badge } from '../../components/ui/badge';
import { Progress } from '../../components/ui/progress';
import { Spinner } from '../../components/ui/spinner';
import { Box } from '../../components/ui/box';
import { Text } from '../../components/ui/text';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { ExternalLink, TextButton } from '../../src/ui/interactions';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLiveGraph } from '../../src/live/useLiveGraph';
import { useRunSteps } from '../../src/live/useRunSteps';
import { requestOf } from '../../src/api/requestOf';
import { useColors } from '../../src/navigation/styles';
import { LiveIndicator } from '../../src/runs/LiveIndicator';
import { MarkdownResult } from '../../src/runs/MarkdownResult';
import { RunRow } from '../../src/runs/RunRow';
import { StepRow } from '../../src/runs/StepRow';
import {
  formatCost,
  formatCount,
  formatDuration,
  relativeTime,
  spendLevel,
} from '../../src/runs/format';
import { useRunDetail } from '../../src/runs/useRunDetail';

const stepsPage = 20;
const requestPreviewLines = 6;

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

export default function RunDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <RunDetailContent key={id} id={id} />;
}

function RunDetailContent({ id }: { id: string }) {
  const { run, fetched, loading, error, refetch } = useRunDetail(id);
  const { graph } = useLiveGraph();
  const runSteps = useRunSteps(id, run, fetched);
  const [shownSteps, setShownSteps] = useState(stepsPage);
  const [requestExpanded, setRequestExpanded] = useState(false);
  const [requestLines, setRequestLines] = useState(0);
  const colors = useColors();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (run?.status !== 'running' || run.finishedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [run?.status, run?.finishedAt]);
  const back = () => router.replace('/');
  const textStyle = [{ fontSize: 17, color: colors.text }];
  const button = (label: string, testID: string, onPress: () => void) => (
    <TextButton
      testID={testID}
      label={label}
      onPress={onPress}
      className="border rounded-lg p-3.5 items-center"
    />
  );
  const section = (label: string, testID: string, children: ReactNode) => (
    <Box testID={testID} className="gap-3">
      <Text accessibilityRole="header" className="text-[13px]" style={[{ color: colors.muted }]}>
        {label}
      </Text>
      {children}
    </Box>
  );
  const header = (
    <Stack.Screen
      options={{
        title: run?.agentName ?? 'Run',
        headerRight: () => <LiveIndicator />,
        headerLeft: () => (
          <TextButton
            testID="run-detail-header-back"
            accessibilityLabel="Back to Runs"
            label="‹ Runs"
            onPress={() => (router.canGoBack() ? router.back() : back())}
          />
        ),
      }}
    />
  );
  if (!run || error)
    return (
      <SafeAreaView
        edges={['left', 'right', 'bottom']}
        className="flex-1 items-center justify-center gap-2 p-6"
        style={[{ backgroundColor: colors.background }]}
      >
        {header}
        {loading ? (
          <Box testID="run-detail-loading" className="items-center gap-4">
            <Spinner />
            <Text style={textStyle}>Loading run…</Text>
          </Box>
        ) : error?.code === 'not_found' ? (
          <Box testID="run-detail-not-found" className="items-center gap-4">
            <Text style={textStyle}>{"This run isn't available any more."}</Text>
            {button('Back to runs', 'run-detail-back', back)}
          </Box>
        ) : (
          <Box className="items-center gap-4">
            <Text style={textStyle}>{"Couldn't load this run."}</Text>
            {button('Retry', 'run-detail-retry', () => void refetch())}
          </Box>
        )}
      </SafeAreaView>
    );

  const cost = formatCost(run.costUsd);
  const budget = formatCost(run.budgetUsd);
  const level = spendLevel(run.costUsd, run.budgetUsd, run.status);
  const ratio =
    run.budgetUsd > 0
      ? Math.min(1, Math.max(0, run.costUsd / run.budgetUsd))
      : run.costUsd > 0
        ? 1
        : 0;
  // A reload with nothing to show yet; an older server stays unsupported.
  const stepsState =
    loading && runSteps.steps.length === 0 && runSteps.state !== 'unsupported'
      ? 'loading'
      : runSteps.state;
  const allStepsShown = shownSteps >= runSteps.steps.length;
  const stepsMessage = {
    unsupported: "Steps aren't available on this server",
    none: 'No steps recorded for this run.',
    waiting: 'Waiting for the first step…',
  } as const;
  const omittedNote = plural(runSteps.omitted, 'earlier step not shown', 'earlier steps not shown');
  const droppedNote = plural(
    runSteps.dropped,
    "step over the server's limit was not recorded",
    "steps over the server's limit were not recorded",
  );
  const request = requestOf(run);
  const requestLong =
    request.kind === 'text' &&
    Math.max(requestLines, request.text.split('\n').length) > requestPreviewLines;
  const children = graph?.runs.filter((child) => child.parentRunId === id) ?? [];
  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      className="flex-1"
      style={[{ backgroundColor: colors.background }]}
    >
      {header}
      <ScrollView
        testID="run-detail"
        contentInsetAdjustmentBehavior="automatic"
        contentContainerClassName="p-6 gap-8"
        refreshControl={
          <RefreshControl
            testID="run-detail-refresh"
            accessibilityLabel="Refresh run"
            refreshing={loading}
            onRefresh={() => void refetch()}
          />
        }
      >
        <Box className="gap-3">
          <Badge
            testID="run-detail-status"
            status={run.status}
            className="self-start px-3.5 py-2 rounded-[18px]"
            textStyle={{ fontSize: 20, fontWeight: '600' }}
          />
          <Text
            testID="run-detail-elapsed"
            className="text-[17px]"
            style={[{ color: colors.muted }]}
          >
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
        </Box>
        {request.kind === 'text' &&
          section(
            'REQUEST',
            'run-detail-request',
            <>
              <Box>
                <Text
                  testID="run-detail-request-text"
                  selectable
                  numberOfLines={requestExpanded ? undefined : requestPreviewLines}
                  style={textStyle}
                >
                  {request.text}
                </Text>
                {/* An unconstrained, hidden copy reports how many lines the full text takes. */}
                <Text
                  testID="run-detail-request-measure"
                  accessible={false}
                  accessibilityElementsHidden
                  importantForAccessibility="no-hide-descendants"
                  pointerEvents="none"
                  className="absolute left-0 right-0 top-0 opacity-0"
                  style={textStyle}
                  onTextLayout={(event) => setRequestLines(event.nativeEvent.lines.length)}
                >
                  {request.text}
                </Text>
              </Box>
              {requestLong && (
                <TextButton
                  testID="run-detail-request-more"
                  label={requestExpanded ? 'Show less' : 'Show all'}
                  expanded={requestExpanded}
                  onPress={() => setRequestExpanded(!requestExpanded)}
                  className="self-start"
                />
              )}
              {request.truncated && (
                <Text
                  testID="run-detail-request-truncated"
                  className="text-[17px]"
                  style={[{ color: colors.muted }]}
                >
                  Showing the first 8,000 characters.
                </Text>
              )}
            </>,
          )}
        {section(
          'SPEND',
          'run-detail-spend',
          <>
            <Text style={textStyle}>
              {cost} of {budget}
            </Text>
            <Progress
              testID="run-detail-spend-bar"
              ratio={ratio}
              level={level}
              accessibilityLabel={`Spent ${cost} of ${budget}`}
              accessibilityValue={{ min: 0, max: run.budgetUsd, now: run.costUsd }}
            />
            <Text testID="run-detail-tokens" style={textStyle}>
              {run.turns} turns · {formatCount(run.tokensIn)} in · {formatCount(run.tokensOut)} out
            </Text>
          </>,
        )}
        {section(
          'STEPS',
          'run-detail-steps',
          stepsState === 'loading' ? (
            <Box
              testID="run-detail-steps-loading"
              accessible
              accessibilityLabel="Loading steps"
              className="flex-row items-center gap-3"
            >
              <Spinner />
              <Text style={textStyle}>Loading steps…</Text>
            </Box>
          ) : stepsState === 'live' || stepsState === 'finished' ? (
            <Box testID={`run-detail-steps-${stepsState}`} className="gap-3">
              {runSteps.steps.length > 0 && (
                <Box testID="run-detail-steps-list">
                  {runSteps.steps.slice(0, shownSteps).map((step) => (
                    <StepRow key={step.seq} step={step} />
                  ))}
                </Box>
              )}
              {runSteps.steps.length > stepsPage && (
                <TextButton
                  testID="run-detail-steps-more"
                  label={allStepsShown ? 'Show fewer' : `Show ${stepsPage} more`}
                  accessibilityLabel={`${allStepsShown ? 'Show fewer steps' : `Show ${stepsPage} more steps`}, ${Math.min(shownSteps, runSteps.steps.length)} of ${runSteps.steps.length} shown`}
                  expanded={allStepsShown}
                  onPress={() => setShownSteps(allStepsShown ? stepsPage : shownSteps + stepsPage)}
                  className="self-start"
                />
              )}
              {stepsState === 'finished' && runSteps.omitted > 0 && (
                <Text
                  testID="run-detail-steps-omitted"
                  accessibilityLabel={omittedNote}
                  className="text-[17px]"
                  style={[{ color: colors.muted }]}
                >
                  {omittedNote}
                </Text>
              )}
              {stepsState === 'finished' && runSteps.dropped > 0 && (
                <Text
                  testID="run-detail-steps-dropped"
                  accessibilityLabel={droppedNote}
                  className="text-[17px]"
                  style={[{ color: colors.muted }]}
                >
                  {droppedNote}
                </Text>
              )}
            </Box>
          ) : (
            <Text
              testID={`run-detail-steps-${stepsState}`}
              accessibilityLabel={stepsMessage[stepsState].replace(/…$/, '')}
              className="text-[17px]"
              style={[{ color: colors.muted }]}
            >
              {stepsMessage[stepsState]}
            </Text>
          ),
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
                <Text className="text-[17px]" style={[{ color: colors.destructive }]}>
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
                className: 'py-3',
              };
              return url ? (
                <ExternalLink key={index} {...props} label={label} url={url} />
              ) : (
                <Box key={index} {...props}>
                  <Text style={textStyle}>{label}</Text>
                </Box>
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
            <Text className="text-[17px]" style={[{ color: colors.destructive }]}>
              {run.error}
            </Text>,
          )}
      </ScrollView>
    </SafeAreaView>
  );
}
