import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/stack';
import { Text, View, TouchableOpacity, SafeAreaView } from 'react-native';
import { initDB } from './src/db/init';
import DiaryScreen from './src/screens/DiaryScreen';
import ChartScreen from './src/screens/ChartScreen';
import ReportScreen from './src/screens/ReportScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import BackupScreen from './src/screens/BackupScreen';
import ProfileContextProvider, { useProfile } from './src/services/profileContext';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

function HeaderProfileSwitcher() {
  const { activeProfile, profiles } = useProfile();
  const navigation = require('@react-navigation/native').useNavigation();
  return (
    <SafeAreaView style={{ backgroundColor: '#EAF6FF' }}>
      <View style={{ padding: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontSize: 18, fontWeight: '600' }}>{activeProfile?.name ?? 'No Profile'}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Profiles')}>
          <Text style={{ color: '#0077CC' }}>{profiles.length > 0 ? 'Switch' : 'Add Profile'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  useEffect(() => {
    initDB();
  }, []);

  return (
    <ProfileContextProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="MainTabs">
            {() => (
              <>
                <HeaderProfileSwitcher />
                <Tab.Navigator screenOptions={{ headerShown: false }}>
                  <Tab.Screen name="Diary" component={DiaryScreen} />
                  <Tab.Screen name="Chart" component={ChartScreen} />
                  <Tab.Screen name="Report" component={ReportScreen} />
                  <Tab.Screen name="SettingsTab" component={SettingsScreen} options={{ title: 'Settings' }} />
                </Tab.Navigator>
              </>
            )}
          </Stack.Screen>
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Backup" component={BackupScreen} />
          <Stack.Screen name="DriveBackups" component={require('./src/screens/DriveBackupsScreen').default} />
          <Stack.Screen name="Profiles" component={require('./src/screens/ProfileManager').default} />
        </Stack.Navigator>
      </NavigationContainer>
    </ProfileContextProvider>
  );
}
