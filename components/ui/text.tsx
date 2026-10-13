import { cn } from 'tailwind-variants';
import { Text as NativeText, type TextProps } from 'react-native';
export function Text(props: TextProps) {
  return <NativeText {...props} />;
}
export function Heading({ className = '', ...props }: TextProps) {
  return (
    <Text
      accessibilityRole="header"
      className={cn(`text-[28px] font-bold`, className)}
      {...props}
    />
  );
}
