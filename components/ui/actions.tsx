import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import { Icon } from './icon';
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
  numberOfLines,
  selectedFill = false,
  destructive = false,
  loading = false,
  accessibilityState,
  style,
  className = '',
  ...props
}: ControlProps & {
  label: string;
  expanded?: boolean;
  numberOfLines?: number;
  destructive?: boolean;
  loading?: boolean;
  selectedFill?: boolean;
}) {
  const colors = useColors();
  const color =
    selectedFill && accessibilityState?.selected
      ? colors.background
      : destructive
        ? colors.destructive
        : colors.tint;
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
      className={cn(
        `flex-row items-center gap-2 justify-center px-2`,
        selectedFill && accessibilityState?.selected && 'bg-accent',
        className,
      )}
      style={style}
    >
      {loading && <Spinner color={color} />}
      <Text
        className={cn(
          'text-[17px] font-semibold shrink',
          selectedFill && accessibilityState?.selected && 'font-bold',
        )}
        style={{ color }}
        numberOfLines={numberOfLines}
        {...(selectedFill && {
          numberOfLines: 1,
          adjustsFontSizeToFit: true,
          minimumFontScale: 0.7,
        })}
      >
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

export function MenuButton({
  label,
  expanded,
  active,
  numberOfLines = 1,
  accessibilityState,
  style,
  className = '',
  ...props
}: ControlProps & {
  label: string;
  expanded: boolean;
  active: boolean;
  numberOfLines?: number;
}) {
  const colors = useColors();
  return (
    <Button
      accessibilityLabel={label}
      {...props}
      accessibilityRole="button"
      accessibilityState={{ ...accessibilityState, expanded, disabled: !!props.disabled }}
      className={cn(
        'flex-row items-center gap-2 justify-center border bg-fill rounded-lg px-3',
        active ? 'border-accent' : 'border-border',
        className,
      )}
      style={style}
    >
      <Text
        className="text-[17px] font-semibold shrink"
        style={{ color: active ? colors.tint : colors.text }}
        numberOfLines={numberOfLines}
        ellipsizeMode="tail"
      >
        {label}
      </Text>
      <Icon as={expanded ? ChevronUp : ChevronDown} size={17} color={colors.muted} />
    </Button>
  );
}
