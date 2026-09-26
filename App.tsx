import React from 'react';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DiaryScreen from './src/screens/DiaryScreen';
import ChartScreen from './src/screens/ChartScreen';
import ReportScreen from './src/screens/ReportScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import BackupScreen from './src/screens/BackupScreen';
import ProfileContextProvider, { useProfile } from './src/services/profileContext';
import ErrorBoundary from './src/components/ErrorBoundary';
import { Button } from './src/theme/components';
import { colors, spacing, typography } from './src/theme/tokens';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TAB_ICONS: Record<string, string> = {
  Diary: '📔',
  Chart: '📈',
  Report: '📄',
  SettingsTab: '⚙️',
};

function TabBarIcon({ route, focused }: { route: string; focused: boolean }) {
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{TAB_ICONS[route] ?? '•'}</Text>
  );
}

// Uses react-native-safe-area-context, not core RN's SafeAreaView — the latter is a
// no-op on Android and was letting this header render under the status bar.
function HeaderProfileSwitcher() {
  const { activeProfile, profiles } = useProfile();
  const navigation = useNavigation<any>();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: colors.primaryMuted }}>
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.md, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={[typography.h2, { flexShrink: 1 }]} numberOfLines={1}>{activeProfile?.name ?? 'No Profile'}</Text>
        <Button
          label={profiles.length > 0 ? 'Switch' : 'Add Profile'}
          size="sm"
          variant="secondary"
          onPress={() => navigation.navigate('Profiles')}
        />
      </View>
    </SafeAreaView>
  );
}

// Deliberately does NOT hardcode tabBarStyle.height/paddingBottom — React Navigation
// only auto-adds the device's bottom safe-area inset (gesture bar / 3-button nav) when
// the tab bar height isn't overridden with a fixed number. A fixed height/paddingBottom
// here previously made the tab bar sit under Android's on-screen nav buttons.
function MainTabs() {
  const insets = useSafeAreaInsets();
  return (
    <>
      <HeaderProfileSwitcher />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabBarIcon route={route.name} focused={focused} />,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarActiveBackgroundColor: colors.primaryMuted,
          tabBarStyle: {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: 49 + insets.bottom + spacing.xs,
            paddingTop: spacing.xs,
          },
          tabBarItemStyle: { borderRadius: 10, marginHorizontal: 6, marginVertical: 4 },
          tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        })}
      >
        <Tab.Screen name="Diary" component={DiaryScreen} />
        <Tab.Screen name="Chart" component={ChartScreen} />
        <Tab.Screen name="Report" component={ReportScreen} />
        <Tab.Screen name="SettingsTab" component={SettingsScreen} options={{ title: 'Settings' }} />
      </Tab.Navigator>
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <ProfileContextProvider>
            <NavigationContainer>
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen name="MainTabs" component={MainTabs} />
                <Stack.Screen name="Settings" component={SettingsScreen} />
                <Stack.Screen name="Backup" component={BackupScreen} />
                <Stack.Screen name="Profiles" component={require('./src/screens/ProfileManager').default} />
                <Stack.Screen name="Parameters" component={require('./src/screens/ParameterTypesScreen').default} />
                <Stack.Screen name="BulkDelete" component={require('./src/screens/BulkDeleteScreen').default} />
              </Stack.Navigator>
            </NavigationContainer>
          </ProfileContextProvider>
        </GestureHandlerRootView>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
