import { Tabs } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Text, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LiveGraphProvider } from '../../src/live/useLiveGraph';
import { useColors } from '../../src/navigation/styles';
import { LiveIndicator } from '../../src/runs/LiveIndicator';

export default function TabsLayout() {
  const colors = useColors();
  const { fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  return (
    <LiveGraphProvider>
      <Tabs
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            const icon =
              route.name === 'index'
                ? 'list-circle'
                : route.name === 'spend'
                  ? 'pie-chart'
                  : 'settings';
            const tab = route.name === 'index' ? 'runs' : route.name;
            return (
              <Ionicons
                name={focused ? icon : `${icon}-outline`}
                size={size}
                color={color}
                accessible={false}
                testID={`tab-${tab}-icon`}
              />
            );
          },
          tabBarLabel: ({ focused, color, children }) => (
            <Text
              testID={`tab-${route.name === 'index' ? 'runs' : route.name}-label`}
              allowFontScaling
              style={{
                color,
                fontSize: 14,
                fontWeight: focused ? '700' : '400',
                textAlign: 'center',
              }}
            >
              {children}
            </Text>
          ),
          tabBarLabelPosition: 'below-icon',
          tabBarAllowFontScaling: true,
          tabBarItemStyle: { minWidth: 44, minHeight: 44 },
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: {
            backgroundColor: colors.background,
            height: 48 + 20 * Math.max(1, fontScale) + insets.bottom,
          },
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
        })}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: 'Runs',
            tabBarAccessibilityLabel: 'Runs',
            tabBarButtonTestID: 'tab-runs',
            headerRight: () => <LiveIndicator />,
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
    </LiveGraphProvider>
  );
}
