import type { PressableProps } from 'react-native';
import { createMenu } from '@gluestack-ui/core/menu/creator';
import { Box } from './box';
import { Pressable } from './pressable';
import { Text } from './text';
import { Divider } from './divider';
function Backdrop(props: PressableProps) {
  return (
    <Pressable
      {...props}
      testID="menu-dismiss"
      accessibilityLabel="Close menu"
      className="absolute inset-0"
    />
  );
}
export const Menu = createMenu({
  Root: Box,
  Item: Pressable,
  Label: Text,
  Backdrop,
  Separator: Divider,
});
