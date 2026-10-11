import { StyleSheet, Text, View } from 'react-native';

import { name } from '../app.identity';

export default function Index() {
  return (
    <View style={styles.container}>
      <Text accessibilityRole="header" style={styles.title} testID="app-name">
        {name}
      </Text>
      <Text testID="connection-status">Not connected</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold' },
});
