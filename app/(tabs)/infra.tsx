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
  nativeKubernetesRows,
  nativeLabelGroups,
  warmPoolLabel,
  type CodingKubernetes,
  type Infra,
  type InfraLabelGroup,
  type NativeKubernetes,
} from '../../src/infra/format';
import { useInfra } from '../../src/infra/useInfra';

// A row id from its label, e.g. "Run label hash" -> "run-label-hash".
const rowId = (label: string) => label.toLowerCase().replace(/[^a-z0-9]+/g, '-');
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
function LabelDisclosure({
  testID,
  groups,
  expanded,
  onToggle,
}: {
  testID: string;
  groups: InfraLabelGroup[];
  expanded: boolean;
  onToggle: () => void;
}) {
  const colors = useColors();
  return (
    <>
      <Box className="items-start">
        <TextButton
          testID={testID}
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
    </>
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
  return (
    <Box testID="infra-coding-kubernetes" className="gap-3">
      {codingKubernetesRows(k8s).map((row) => (
        <Row
          key={row.label}
          label={row.label}
          value={row.value}
          testID={`infra-coding-kubernetes-row-${rowId(row.label)}`}
        />
      ))}
      <LabelDisclosure
        testID="infra-coding-labels-toggle"
        groups={codingLabelGroups(k8s)}
        expanded={expanded}
        onToggle={onToggle}
      />
    </Box>
  );
}
function NativeKubernetesBlock({
  k8s,
  expanded,
  onToggle,
}: {
  k8s: NativeKubernetes;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <Box testID="infra-native-kubernetes" className="gap-3">
      {nativeKubernetesRows(k8s).map((row) => (
        <Row
          key={row.label}
          label={row.label}
          value={row.value}
          testID={`infra-native-kubernetes-row-${rowId(row.label)}`}
        />
      ))}
      <LabelDisclosure
        testID="infra-native-labels-toggle"
        groups={nativeLabelGroups(k8s)}
        expanded={expanded}
        onToggle={onToggle}
      />
    </Box>
  );
}
export default function Infrastructure() {
  const colors = useColors();
  const { infra, loading, error, refetch } = useInfra();
  // Labels stay open only for the response they were opened on, so every refetch collapses them.
  const [labelsOpenFor, setLabelsOpenFor] = useState<Infra | null>(null);
  const labelsExpanded = infra !== null && labelsOpenFor === infra;
  const [nativeLabelsOpenFor, setNativeLabelsOpenFor] = useState<Infra | null>(null);
  const nativeLabelsExpanded = infra !== null && nativeLabelsOpenFor === infra;
  const muted = { color: colors.muted };
  return (
    <SafeAreaView
      testID="screen-infra"
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
            <>
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
              <Box testID="infra-native" className="gap-3">
                <Header label="NATIVE AGENTS" />
                {infra.native ? (
                  <>
                    <Row
                      label="Launcher"
                      value={launcherLabel(infra.native.launcher)}
                      testID="infra-native-launcher"
                    />
                    <Row
                      label="Warm pool"
                      value={warmPoolLabel(infra.native.warmPoolSize)}
                      testID="infra-native-warm-pool"
                    />
                    {infra.native.kubernetes && (
                      <NativeKubernetesBlock
                        k8s={infra.native.kubernetes}
                        expanded={nativeLabelsExpanded}
                        onToggle={() => setNativeLabelsOpenFor(nativeLabelsExpanded ? null : infra)}
                      />
                    )}
                  </>
                ) : (
                  <Text testID="infra-native-not-configured" style={muted}>
                    Native agents aren&apos;t configured on this server.
                  </Text>
                )}
              </Box>
            </>
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
