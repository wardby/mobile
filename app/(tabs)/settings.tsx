import { Box } from '../../components/ui/box';
import { ButtonGroup } from '../../components/ui/button';
import { useAppearance } from '../../src/settings/appearance';
import { Text } from '../../components/ui/text';
import Constants from 'expo-constants';
import { Alert, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { TextButton } from '../../src/ui/interactions';
import { useSession } from '../../src/auth/session';
import { useColors } from '../../src/navigation/styles';

export default function Settings() {
  const auth = useSession();
  const { setting, setSetting } = useAppearance();
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
      className="flex-1"
      style={[{ backgroundColor: colors.background }]}
    >
      <ScrollView contentContainerClassName="p-6 gap-8">
        <Box className="gap-3">
          <Text className="text-[13px]" style={[{ color: colors.muted }]}>
            SERVER
          </Text>
          <Text testID="settings-host" className="text-[17px]" style={[{ color: colors.text }]}>
            {host}
          </Text>
        </Box>
        <Box className="gap-3">
          <Text className="text-[13px]" style={[{ color: colors.muted }]}>
            APPEARANCE
          </Text>
          <ButtonGroup
            testID="settings-appearance"
            accessibilityLabel="Appearance"
            className="flex-row border rounded-lg overflow-hidden"
            style={{ borderColor: colors.muted, borderWidth: StyleSheet.hairlineWidth }}
          >
            {(['system', 'light', 'dark'] as const).map((option) => (
              <TextButton
                key={option}
                testID={`settings-appearance-${option}`}
                label={option[0].toUpperCase() + option.slice(1)}
                selectedFill
                accessibilityState={{ selected: setting === option }}
                className="flex-1 py-2 items-center"
                onPress={() => setSetting(option)}
              />
            ))}
          </ButtonGroup>
        </Box>
        <Box className="gap-3">
          <Text className="text-[13px]" style={[{ color: colors.muted }]}>
            APP
          </Text>
          <Box className="flex-row justify-between gap-4">
            <Text className="text-[17px]" style={[{ color: colors.text }]}>
              Version
            </Text>
            <Text
              testID="settings-version"
              className="text-[17px]"
              style={[{ color: colors.text }]}
            >
              {Constants.expoConfig?.version}
            </Text>
          </Box>
        </Box>
        <TextButton
          testID="settings-sign-out"
          accessibilityLabel="Sign out"
          label="Sign out"
          destructive
          className="border rounded-lg p-3.5 items-center"
          style={[{ borderColor: colors.destructive }]}
          onPress={confirmSignOut}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
