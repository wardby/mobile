import { Redirect } from 'expo-router';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useSession } from '../src/auth/session';
import { styles, useColors } from '../src/auth/styles';

export default function Index() {
  const auth = useSession();
  const colors = useColors();
  if (!auth.ready) return <ActivityIndicator accessibilityLabel="Loading session" />;
  if (auth.status !== 'signedIn') return <Redirect href="/connect" />;
  return (
    <View style={[styles.content, { backgroundColor: colors.background }]}>
      <Text style={[styles.text, { color: colors.text }]}>Signed in to</Text>
      <Text testID="signed-in-host" style={[styles.text, { color: colors.text }]}>
        {auth.host ? new URL(auth.host).host : ''}
      </Text>
      <Pressable
        testID="sign-out"
        accessibilityLabel="Sign out"
        accessibilityRole="button"
        style={[styles.button, { borderColor: colors.border }]}
        onPress={() => {
          void auth.signOut();
        }}
      >
        <Text style={[styles.text, { color: colors.text }]}>Sign out</Text>
      </Pressable>
    </View>
  );
}
