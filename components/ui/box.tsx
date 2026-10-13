import { cn } from 'tailwind-variants';
import { View, type ViewProps } from 'react-native';
export function Box(props: ViewProps) {
  return <View {...props} />;
}
export function VStack({ className = '', ...props }: ViewProps) {
  return <Box className={cn(`flex-col`, className)} {...props} />;
}
export function HStack({ className = '', ...props }: ViewProps) {
  return <Box className={cn(`flex-row`, className)} {...props} />;
}
