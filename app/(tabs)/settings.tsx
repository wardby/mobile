import Constants from 'expo-constants';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useSession } from '../../src/auth/session';
import { styles, useColors } from '../../src/navigation/styles';

export default function Settings() {
  const auth = useSession();
  const colors = useColors();
  const host = auth.host ? new URL(auth.host).host : '';
  function confirmSignOut() {
    Alert.alert(`Sign out of ${host}?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: () => {
          void auth.signOut();
        },
      },
    ]);
  }
  return (
    <SafeAreaView
      edges={['left', 'right']}
      style={[styles.screen, { backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.muted }]}>SERVER</Text>
          <Text testID="settings-host" style={[styles.text, { color: colors.text }]}>
            {host}
          </Text>
        </View>
        <View style={styles.section}>
          <Text style={[styles.label, { color: colors.muted }]}>APP</Text>
          <View style={styles.row}>
            <Text style={[styles.text, { color: colors.text }]}>Version</Text>
            <Text testID="settings-version" style={[styles.text, { color: colors.text }]}>
              {Constants.expoConfig?.version}
            </Text>
          </View>
        </View>
        <Pressable
          testID="settings-sign-out"
          accessibilityLabel="Sign out"
          accessibilityRole="button"
          style={[styles.button, { borderColor: colors.destructive }]}
          onPress={confirmSignOut}
        >
          <Text style={[styles.text, { color: colors.destructive }]}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
