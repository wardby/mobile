import { useLocalSearchParams } from 'expo-router';
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { styles, useColors } from '../../src/navigation/styles';

export default function RunDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useColors();
  return (
    <SafeAreaView
      testID="run-detail-placeholder"
      edges={['left', 'right']}
      style={[styles.placeholder, { backgroundColor: colors.background }]}
    >
      <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
        {id}
      </Text>
      <Text style={[styles.text, { color: colors.muted }]}>Run detail coming soon.</Text>
    </SafeAreaView>
  );
}
