import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles, useColors } from './styles';

export function Placeholder({ title, testID }: { title: string; testID: string }) {
  const colors = useColors();
  return (
    <SafeAreaView
      testID={testID}
      edges={['left', 'right']}
      style={[styles.placeholder, { backgroundColor: colors.background }]}
    >
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.text, { color: colors.muted }]}>Coming soon.</Text>
    </SafeAreaView>
  );
}
