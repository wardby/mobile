import { Tabs } from 'expo-router';
import { useColors } from '../../src/navigation/styles';

export default function TabsLayout() {
  const colors = useColors();
  return (
    <Tabs
      screenOptions={{
        tabBarIcon: () => null,
        tabBarIconStyle: { display: 'none' },
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.background },
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Runs',
          tabBarAccessibilityLabel: 'Runs',
          tabBarButtonTestID: 'tab-runs',
        }}
      />
      <Tabs.Screen
        name="spend"
        options={{
          title: 'Spend',
          tabBarAccessibilityLabel: 'Spend',
          tabBarButtonTestID: 'tab-spend',
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarAccessibilityLabel: 'Settings',
          tabBarButtonTestID: 'tab-settings',
        }}
      />
    </Tabs>
  );
}
