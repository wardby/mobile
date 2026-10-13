import { cn } from 'tailwind-variants';
import type { ReactNode } from 'react';
import type { PressableProps } from 'react-native';
import { Button } from './button';
import { Pressable } from './pressable';
import { Text } from './text';
import { Spinner } from './spinner';
import { Link } from './link';
import { useTheme as useColors } from './provider';

type ControlProps = Omit<PressableProps, 'children'>;

export function ExternalLink({
  label,
  url,
  ...props
}: Omit<ControlProps, 'onPress' | 'accessibilityRole'> & { label: string; url: string }) {
  return <Link label={label} url={url} {...props} />;
}

export function NavigationRow({
  children,
  style,
  className = '',
  ...props
}: ControlProps & { children: ReactNode }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      {...props}
      className={cn(`flex-row items-center gap-2`, className)}
      style={style}
    >
      {children}
      <Text accessible={false} className="text-[24px]" style={{ color: colors.tint }}>
        ›
      </Text>
    </Pressable>
  );
}

export function TextButton({
  label,
  expanded,
  destructive = false,
  loading = false,
  accessibilityState,
  style,
  className = '',
  ...props
}: ControlProps & { label: string; expanded?: boolean; destructive?: boolean; loading?: boolean }) {
  const colors = useColors();
  const color = destructive ? colors.destructive : colors.tint;
  return (
    <Button
      accessibilityRole="button"
      accessibilityLabel={label}
      {...props}
      accessibilityState={{
        ...accessibilityState,
        disabled: !!props.disabled,
        ...(expanded === undefined ? {} : { expanded }),
      }}
      className={cn(`flex-row items-center gap-2 justify-center px-2`, className)}
      style={(state) => [
        accessibilityState?.selected && { borderBottomWidth: 2, borderBottomColor: colors.tint },
        typeof style === 'function' ? style(state) : style,
      ]}
    >
      {loading && <Spinner color={color} />}
      <Text className="text-[17px] font-semibold shrink" style={{ color }}>
        {label}
      </Text>
      {expanded !== undefined && (
        <Text accessible={false} className="text-[17px] font-semibold shrink" style={{ color }}>
          {expanded ? '▴' : '▾'}
        </Text>
      )}
    </Button>
  );
}
