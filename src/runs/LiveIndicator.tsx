import { StyleSheet, Text, View } from 'react-native';
import { useLiveGraph, type LiveStatus } from '../live/useLiveGraph';
import { useColors } from '../navigation/styles';

const indicators: Record<LiveStatus, { label: string; dot: string }> = {
  live: { label: 'Live', dot: '#34c759' },
  reconnecting: { label: 'Reconnecting', dot: '#ff9f0a' },
  connecting: { label: 'Connecting', dot: '#ff9f0a' },
  offline: { label: 'Offline', dot: '#8e8e93' },
};

export function LiveIndicator() {
  const { status } = useLiveGraph();
  const colors = useColors();
  const { label, dot } = indicators[status];
  return (
    <View
      testID="runs-live-indicator"
      accessible
      accessibilityLabel={label}
      style={styles.indicator}
    >
      <View testID="runs-live-dot" style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  indicator: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 15 },
});
