import { createProgress } from '@gluestack-ui/core/progress/creator';
import type { ViewProps } from 'react-native';
import { Box } from './box';
import { useTheme, useThemeMode } from './provider';
import { statusTokens } from './theme';
const UIProgress = createProgress({ Root: Box, FilledTrack: Box });
export function Progress({
  ratio,
  level,
  style,
  ...props
}: ViewProps & { ratio: number; level: 'ok' | 'warn' | 'over' }) {
  const colors = useTheme();
  const mode = useThemeMode();
  return (
    <UIProgress
      value={ratio * 100}
      {...props}
      accessibilityRole="progressbar"
      className="h-2 overflow-hidden rounded"
      style={[
        {
          height: 8,
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: statusTokens.grey[mode].background,
        },
        style,
      ]}
    >
      <Box
        testID={props.testID ? `${props.testID}-fill` : undefined}
        className="h-full"
        style={[
          {
            height: '100%',
            width: `${Math.min(1, Math.max(0, ratio)) * 100}%`,
            backgroundColor: colors.progress[level],
          },
        ]}
      />
    </UIProgress>
  );
}
