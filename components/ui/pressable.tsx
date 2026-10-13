import { createPressable } from '@gluestack-ui/core/pressable/creator';
import { Pressable as NativePressable, type PressableProps } from 'react-native';
import { useTheme } from './provider';
const UIPressable = createPressable({ Root: NativePressable });
export function Pressable({ style, disabled, accessibilityState, ...props }: PressableProps) {
  const colors = useTheme();
  return (
    <UIPressable
      accessible
      {...props}
      disabled={disabled}
      accessibilityState={{
        ...accessibilityState,
        ...(disabled === undefined ? {} : { disabled: !!disabled }),
      }}
      android_ripple={{ color: colors.tint }}
      style={(state) => [
        { minHeight: 44, minWidth: 44, opacity: disabled ? 0.5 : state.pressed ? 0.6 : 1 },
        typeof style === 'function' ? style(state) : style,
      ]}
    />
  );
}
