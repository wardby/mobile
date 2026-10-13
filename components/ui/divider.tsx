import { StyleSheet, type ViewProps } from 'react-native';
import { Box } from './box';
import { useTheme } from './provider';
export function Divider({ style, ...props }: ViewProps) {
  const colors = useTheme();
  return (
    <Box
      className="bg-muted"
      {...props}
      style={[{ height: StyleSheet.hairlineWidth, backgroundColor: colors.muted }, style]}
    />
  );
}
