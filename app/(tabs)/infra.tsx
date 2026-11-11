import { useState } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Box } from '../../components/ui/box';
import { Text } from '../../components/ui/text';
import { Spinner } from '../../components/ui/spinner';
import { TextButton } from '../../src/ui/interactions';
import { useColors } from '../../src/navigation/styles';
import {
  CODING_NOT_CONFIGURED_TEXT,
  codingKubernetesRows,
  codingLabelGroups,
  isCodingLauncherConfigured,
  labelEntryCount,
  launcherLabel,
  type CodingKubernetes,
  type Infra,
} from '../../src/infra/format';
import { useInfra } from '../../src/infra/useInfra';

function Header({ label }: { label: string }) {
  const colors = useColors();
  return (
    <Text accessibilityRole="header" className="text-[13px]" style={{ color: colors.muted }}>
      {label}
    </Text>
  );
}
function Row({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const colors = useColors();
  return (
    <Box className="flex-row justify-between gap-4">
      <Text className="text-[17px]" style={{ color: colors.text }}>
        {label}
      </Text>
      <Text
        testID={testID}
        className="text-[17px] shrink text-right"
        style={{ color: colors.text }}
      >
        {value}
      </Text>
    </Box>
  );
}
function CodingKubernetesBlock({
  k8s,
  expanded,
  onToggle,
}: {
  k8s: CodingKubernetes;
  expanded: boolean;
  onToggle: () => void;
}) {
  const colors = useColors();
  const groups = codingLabelGroups(k8s);
  return (
    <Box testID="infra-coding-kubernetes" className="gap-3">
      {codingKubernetesRows(k8s).map((row) => (
        <Row key={row.label} label={row.label} value={row.value} />
      ))}
      <Box className="items-start">
        <TextButton
          testID="infra-coding-labels-toggle"
          label={expanded ? 'Hide labels' : `Show labels (${labelEntryCount(groups)})`}
          expanded={expanded}
          onPress={onToggle}
        />
      </Box>
      {expanded &&
        groups.map((group) => (
          <Box key={group.label} className="gap-1">
            <Text className="text-[17px]" style={{ color: colors.text }}>
              {group.label}
            </Text>
            {group.entries.length === 0 ? (
              <Text style={{ color: colors.muted }}>None</Text>
            ) : (
              group.entries.map((entry) => (
                <Text key={entry} style={{ color: colors.muted }}>
                  {entry}
                </Text>
              ))
            )}
          </Box>
        ))}
    </Box>
  );
}
export default function Infrastructure() {
  const colors = useColors();
  const { infra, loading, error, refetch } = useInfra();
  // Labels stay open only for the response they were opened on, so every refetch collapses them.
  const [labelsOpenFor, setLabelsOpenFor] = useState<Infra | null>(null);
  const labelsExpanded = infra !== null && labelsOpenFor === infra;
  const muted = { color: colors.muted };
  return (
    <SafeAreaView
      edges={['left', 'right']}
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <ScrollView
        testID="infra-scroll"
        contentContainerStyle={{ flexGrow: 1 }}
        contentContainerClassName="p-6 gap-8"
        refreshControl={
          <RefreshControl
            testID="infra-refresh"
            accessibilityLabel="Refresh infrastructure"
            refreshing={loading && infra !== null}
            onRefresh={refetch}
          />
        }
      >
        {error ? (
          <Box testID="infra-error" className="items-center gap-2">
            <Text style={muted}>Couldn&apos;t load infrastructure.</Text>
            <TextButton testID="infra-retry" label="Retry" onPress={refetch} />
          </Box>
        ) : loading && !infra ? (
          <Box testID="infra-loading" className="flex-1 items-center justify-center gap-2">
            <Spinner accessibilityLabel="Loading infrastructure" />
            <Text style={muted}>Loading infrastructure…</Text>
          </Box>
        ) : (
          infra && (
            <Box testID="infra-coding" className="gap-3">
              <Header label="CODING LAUNCHER" />
              <Row
                label="Launcher"
                value={launcherLabel(infra.launcher)}
                testID="infra-coding-launcher"
              />
              {!isCodingLauncherConfigured(infra.launcher) ? (
                <Text testID="infra-coding-not-configured" style={muted}>
                  {CODING_NOT_CONFIGURED_TEXT}
                </Text>
              ) : infra.kubernetes ? (
                <CodingKubernetesBlock
                  k8s={infra.kubernetes}
                  expanded={labelsExpanded}
                  onToggle={() => setLabelsOpenFor(labelsExpanded ? null : infra)}
                />
              ) : (
                infra.launcher === 'kubernetes' && (
                  <Text testID="infra-coding-kubernetes-missing" style={muted}>
                    Kubernetes details not reported
                  </Text>
                )
              )}
            </Box>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
