import { cn } from 'tailwind-variants';
import { Linking, type PressableProps } from 'react-native';
import ArrowUpRight from 'lucide-react-native/icons/arrow-up-right';
import { Pressable } from './pressable';
import { Text } from './text';
import { Icon } from './icon';
import { useTheme } from './provider';
export function Link({
  label,
  url,
  style,
  className = '',
  ...props
}: Omit<PressableProps, 'children' | 'onPress' | 'accessibilityRole'> & {
  label: string;
  url: string;
}) {
  const colors = useTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      {...props}
      accessibilityRole="link"
      accessibilityHint="Opens in the browser"
      onPress={() => {
        void Linking.openURL(url).catch(() => {});
      }}
      className={cn(`flex-row items-center gap-2`, className)}
      style={(state) => [typeof style === 'function' ? style(state) : style]}
    >
      <Text className="text-accent text-[17px] font-semibold shrink" style={{ color: colors.tint }}>
        {label}
      </Text>
      <Text accessible={false} className="sr-only" style={{ display: 'none' }}>
        ↗
      </Text>
      <Icon as={ArrowUpRight} size={17} color={colors.tint} />
    </Pressable>
  );
}
