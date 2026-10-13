import { useTheme } from '../../components/ui/provider';
import { Box } from '../../components/ui/box';
import { Text } from '../../components/ui/text';

import { useLiveGraph, type LiveStatus } from '../live/useLiveGraph';
import { useColors } from '../navigation/styles';

const indicators: Record<LiveStatus, { label: string; tone: 'ok' | 'warn' | 'offline' }> = {
  live: { label: 'Live', tone: 'ok' },
  reconnecting: { label: 'Reconnecting', tone: 'warn' },
  connecting: { label: 'Connecting', tone: 'warn' },
  offline: { label: 'Offline', tone: 'offline' },
};

export function LiveIndicator() {
  const { status } = useLiveGraph();
  const colors = useColors();
  const { label, tone } = indicators[status];
  const theme = useTheme();
  const dot = tone === 'offline' ? theme.offline : theme.progress[tone];
  return (
    <Box
      testID="runs-live-indicator"
      accessible
      accessibilityLabel={label}
      className="flex-row items-center gap-1.5 px-4"
    >
      <Box testID="runs-live-dot" className="w-2 h-2 rounded" style={[{ backgroundColor: dot }]} />
      <Text className="text-[15px]" style={[{ color: colors.text }]}>
        {label}
      </Text>
    </Box>
  );
}
