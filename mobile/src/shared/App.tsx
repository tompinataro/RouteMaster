import React, { useEffect } from 'react';
import { Text, Pressable, View, Platform, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { AuthProvider, useAuth } from './auth/provider';
import { colors } from './theme';
import type { RootStackParamList } from './navigationTypes';
import * as Updates from 'expo-updates';

import HomeScreen from './screens/HomeScreen';
import AboutScreen from './screens/AboutScreen';
import LoginLandingScreen from './screens/LoginLandingScreen';
import RouteListScreen from './screens/RouteListScreen';
import VisitDetailScreen from './screens/VisitDetailScreen';
import { GlobalBannerProvider } from './components/GlobalBannerProvider';
import Constants from 'expo-constants';
import DeleteAccountScreen from './screens/DeleteAccountScreen';
import AccountScreen from './screens/AccountScreen';
import FieldTechniciansScreen from './screens/FieldTechniciansScreen';
import ClientLocationsScreen from './screens/ClientLocationsScreen';
import ServiceRoutesScreen from './screens/ServiceRoutesScreen';
import AllServiceRoutesScreen from './screens/AllServiceRoutesScreen';
import AllFieldTechniciansScreen from './screens/AllFieldTechniciansScreen';
import EditFieldTechScreen from './screens/EditFieldTechScreen';
import ReportsScreen from './screens/ReportsScreen';

const Stack = createStackNavigator<RootStackParamList>();

function TechStack() {
  return (
    <Stack.Navigator
      initialRouteName="RouteList"
      screenOptions={{ headerTitleAlign: 'center', headerTitleStyle: { fontWeight: '700' } }}
      key="tech-stack"
    >
      <Stack.Screen
        name="RouteList"
        component={RouteListScreen}
        options={{
          title: "Today's Route",
          headerLeft: () => null,
        }}
      />
      <Stack.Screen
        name="VisitDetail"
        component={VisitDetailScreen}
        options={({ navigation }) => ({
          title: 'Visit',
          headerBackTitleVisible: false,
          headerLeft: () => (
            <Pressable
              onPress={() => navigation.goBack()}
              style={{ paddingLeft: 28, paddingRight: 8, paddingVertical: 0, transform: [{ translateY: 2 }] }}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Text style={{ fontSize: 44, fontWeight: '700', lineHeight: 44 }}>{'‹'}</Text>
            </Pressable>
          ),
          headerTitleStyle: { fontWeight: '700', fontSize: 20 },
        })}
      />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
    </Stack.Navigator>
  );
}

function AdminStack() {
  return (
    <Stack.Navigator
      initialRouteName="Account"
      screenOptions={{ headerTitleAlign: 'center', headerTitleStyle: { fontWeight: '700' } }}
      key="admin-stack"
    >
      <Stack.Screen name="Account" component={AccountScreen} options={{ title: 'Admin Home' }} />
      <Stack.Screen
        name="FieldTechnicians"
        component={FieldTechniciansScreen}
        options={{ title: 'Field Technicians', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="ClientLocations"
        component={ClientLocationsScreen}
        options={{ title: 'Client Locations', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="ServiceRoutes"
        component={ServiceRoutesScreen}
        options={{ title: 'Service Routes', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="AllServiceRoutes"
        component={AllServiceRoutesScreen}
        options={{ title: 'All Service Routes', headerBackTitle: 'Back' }}
      />
      <Stack.Screen
        name="AllFieldTechnicians"
        component={AllFieldTechniciansScreen}
        options={{ title: 'All Field Technicians', headerBackTitle: 'Back' }}
      />
      <Stack.Screen name="EditFieldTech" component={EditFieldTechScreen} options={{ title: 'Edit Field Tech' }} />
      <Stack.Screen
        name="Reports"
        component={ReportsScreen}
        options={{ title: 'Reports', headerBackTitle: 'Back' }}
      />
      <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} options={{ title: 'Delete Account' }} />
      <Stack.Screen name="About" component={AboutScreen} />
      <Stack.Screen name="Home" component={HomeScreen} />
    </Stack.Navigator>
  );
}

function RootNavigator() {
  const { token, loading, user } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#e7bfbf', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  return token ? (
    user?.role === 'admin' ? <AdminStack /> : <TechStack />
  ) : (
    <Stack.Navigator initialRouteName="LoginLanding">
      <Stack.Screen name="LoginLanding" component={LoginLandingScreen} options={{ headerShown: false }} />
    </Stack.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    async function checkForUpdates() {
      if (!__DEV__ && Platform.OS !== 'web') {
        try {
          const update = await Updates.checkForUpdateAsync();
          if (update.isAvailable) {
            await Updates.fetchUpdateAsync();
            await Updates.reloadAsync();
          }
        } catch (e) {
          console.log('Update check failed:', e);
        }
      }
    }
    checkForUpdates();

    const ownership = (Constants as any)?.appOwnership;
    const isStandalone = ownership === 'standalone';
    if (!__DEV__ && Platform.OS !== 'web' && isStandalone) {
      import('./background').then(m => m.registerBackgroundSync?.()).catch(() => {});
    }
  }, []);
  return (
    <AuthProvider>
      <GlobalBannerProvider>
        <NavigationContainer
          theme={{
            ...DefaultTheme,
            colors: {
              ...DefaultTheme.colors,
              primary: colors.primary,
              background: colors.background,
              card: colors.card,
              text: colors.text,
              border: colors.border,
            },
          }}
        >
          <StatusBar style="auto" />
          <RootNavigator />
        </NavigationContainer>
      </GlobalBannerProvider>
    </AuthProvider>
  );
}
