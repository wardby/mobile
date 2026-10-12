import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
} from 'react-native';
import { useColors } from '../navigation/styles';

type ControlProps = Omit<PressableProps, 'children'>;

// One feedback implementation for links, rows and actions, including Android ripple.
function Control({ style, disabled, children, ...props }: PressableProps) {
  const colors = useColors();
  return (
    <Pressable
      accessible
      {...props}
      disabled={disabled}
      android_ripple={{ color: colors.tint }}
      style={(state) => [
        styles.target,
        typeof style === 'function' ? style(state) : style,
        { opacity: disabled ? 0.5 : state.pressed ? 0.6 : 1 },
      ]}
    >
      {children}
    </Pressable>
  );
}

export function ExternalLink({
  label,
  url,
  ...props
}: Omit<ControlProps, 'onPress' | 'accessibilityRole'> & { label: string; url: string }) {
  const colors = useColors();
  return (
    <Control
      accessibilityLabel={label}
      {...props}
      accessibilityRole="link"
      accessibilityHint="Opens in the browser"
      onPress={() => {
        void Linking.openURL(url).catch(() => {});
      }}
      style={(state) => [
        styles.inline,
        typeof props.style === 'function' ? props.style(state) : props.style,
      ]}
    >
      <Text style={[styles.text, { color: colors.tint }]}>{label}</Text>
      <Text accessible={false} style={[styles.text, { color: colors.tint }]}>
        ↗
      </Text>
    </Control>
  );
}

export function NavigationRow({
  children,
  style,
  ...props
}: ControlProps & { children: ReactNode }) {
  const colors = useColors();
  return (
    <Control
      accessibilityRole="button"
      {...props}
      style={(state) => [styles.inline, typeof style === 'function' ? style(state) : style]}
    >
      {children}
      <Text accessible={false} style={[styles.chevron, { color: colors.tint }]}>
        ›
      </Text>
    </Control>
  );
}

export function TextButton({
  label,
  expanded,
  destructive = false,
  loading = false,
  accessibilityState,
  style,
  ...props
}: ControlProps & { label: string; expanded?: boolean; destructive?: boolean; loading?: boolean }) {
  const colors = useColors();
  const color = destructive ? colors.destructive : colors.tint;
  return (
    <Control
      accessibilityRole="button"
      accessibilityLabel={label}
      {...props}
      accessibilityState={{
        ...accessibilityState,
        disabled: !!props.disabled,
        ...(expanded === undefined ? {} : { expanded }),
      }}
      style={(state) => [
        styles.inline,
        styles.button,
        accessibilityState?.selected && { borderBottomWidth: 2, borderBottomColor: colors.tint },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {loading && <ActivityIndicator color={color} />}
      <Text style={[styles.text, { color }]}>{label}</Text>
      {expanded !== undefined && (
        <Text accessible={false} style={[styles.text, { color }]}>
          {expanded ? '▴' : '▾'}
        </Text>
      )}
    </Control>
  );
}

const styles = StyleSheet.create({
  target: { minHeight: 44, minWidth: 44 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  button: { justifyContent: 'center', paddingHorizontal: 8 },
  text: { fontSize: 17, fontWeight: '600', flexShrink: 1 },
  chevron: { fontSize: 24 },
});
