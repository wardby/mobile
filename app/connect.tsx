import { useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
} from 'react-native';
import { name } from '../app.identity';
import { messages } from '../src/auth/errors';
import { useSession } from '../src/auth/session';
import { styles, useColors } from '../src/auth/styles';

export default function Connect() {
  const [host, setHost] = useState('');
  const auth = useSession();
  const router = useRouter();
  const colors = useColors();
  const busy = auth.status === 'signingIn';
  async function submit() {
    if (!host.trim() || busy) return;
    try {
      await auth.signIn(host);
      router.replace('/');
    } catch {
      /* Session exposes the inline error. */
    }
  }
  return (
    <KeyboardAvoidingView
      style={[styles.keyboard, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
      >
        <Text accessibilityRole="header" style={[styles.title, { color: colors.text }]}>
          {name}
        </Text>
        <Text style={[styles.text, { color: colors.text }]}>Server</Text>
        <TextInput
          testID="connect-host"
          accessibilityLabel="Server"
          placeholder="wardby.example.com"
          placeholderTextColor={colors.border}
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          value={host}
          keyboardType="url"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!busy}
          returnKeyType="go"
          onSubmitEditing={() => {
            void submit();
          }}
          onChangeText={(value) => {
            setHost(value);
            auth.clearError();
          }}
        />
        <Text style={{ color: colors.text }}>Your own wardby server</Text>
        {auth.error && (
          <Text
            testID="connect-error"
            accessibilityRole="alert"
            accessibilityLiveRegion="polite"
            style={{ color: colors.text }}
          >
            {messages[auth.error.code]}
          </Text>
        )}
        <Pressable
          testID="connect-submit"
          accessibilityLabel={busy ? 'Signing in…' : 'Sign in'}
          accessibilityRole="button"
          disabled={!host.trim() || busy}
          style={[
            styles.button,
            { borderColor: colors.border },
            (!host.trim() || busy) && styles.disabled,
          ]}
          onPress={() => {
            void submit();
          }}
        >
          {busy && <ActivityIndicator color={colors.text} />}
          <Text style={[styles.text, { color: colors.text }]}>
            {busy ? 'Signing in…' : 'Sign in'}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
