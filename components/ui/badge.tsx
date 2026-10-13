import { cn } from 'tailwind-variants';
import type { ViewProps, StyleProp, TextStyle } from 'react-native';
import { statusStyle, type RunStatus } from '../../src/runs/status';
import { useThemeMode } from './provider';
import { Box } from './box';
import { Text } from './text';
export function Badge({
  status,
  style,
  textStyle,
  className = '',
  ...props
}: ViewProps & { status: RunStatus; textStyle?: StyleProp<TextStyle> }) {
  const pill = statusStyle(status);
  const colors = pill[useThemeMode()];
  return (
    <Box
      {...props}
      className={cn('rounded-[10px] px-2 py-0.5', className)}
      style={[{ backgroundColor: colors.background }, style]}
    >
      <Text style={[{ fontSize: 13, fontWeight: '600', color: colors.text }, textStyle]}>
        {pill.label}
      </Text>
    </Box>
  );
}
