import { cn } from 'tailwind-variants';
import { createButton } from '@gluestack-ui/core/button/creator';
import type { PressableProps } from 'react-native';
import { Pressable } from './pressable';
import { Text } from './text';
import { Box } from './box';
import { Spinner } from './spinner';
import { Icon } from './icon';
const UIButton = createButton({ Root: Pressable, Text, Group: Box, Spinner, Icon });
export function Button({ disabled, ...props }: PressableProps) {
  return <UIButton {...props} isDisabled={!!disabled} />;
}
export function ButtonGroup({ className = '', ...props }: React.ComponentProps<typeof Box>) {
  return <Box className={cn(`flex-row`, className)} {...props} />;
}
