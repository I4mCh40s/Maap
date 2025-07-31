// App.tsx
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { auth } from './src/firebase';
import * as SecureStore from 'expo-secure-store';

import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen      from './src/screens/LoginScreen';
import SignupScreen     from './src/screens/SignupScreen';
import AppTabs          from './src/navigation/AppTabs';
import LockScreen       from './src/screens/LockScreen';
import BusinessSetupScreen from './src/screens/BusinessSetupScreen';

import VaultHuntScreen from './src/screens/VaultHuntScreen'; // <-- IMPORT 1
import RewardScreen from './src/screens/RewardScreen'; // <-- IMPORT 2
import { Vault } from './src/core/types'; // <-- IMPORT YOUR VAULT TYPE

import BusinessDashboard from './src/screens/BusinessDashboard';
import CreateVaultScreen from './src/screens/CreateVaultScreen';

// --- IMPORT THE GESTURE HANDLER WRAPPER ---
import { GestureHandlerRootView } from 'react-native-gesture-handler'; 

// This is your existing stack for logged-out users
type AuthStackParamList = {
  Onboarding: undefined;
  Login:      undefined;
  Signup:     undefined;
};
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AuthStackScreens = () => (
    <AuthStack.Navigator initialRouteName="Onboarding" screenOptions={{ headerShown: false }}>
        <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
        <AuthStack.Screen name="Login"      component={LoginScreen} />
        <AuthStack.Screen name="Signup"     component={SignupScreen} />
    </AuthStack.Navigator>
);

type AppStackParamList = { 
    Main: undefined;
    VaultHunt: { vaultId: string };
    Reward: { vault: Vault };
    // --- ADD THE NEW ROUTES ---
    BusinessDashboard: { businessId: string };
    CreateVault: undefined; // No params needed, it finds info from auth user
    BusinessSetup: undefined;
};
const AppStack  = createNativeStackNavigator<AppStackParamList>();

const AppStackScreens = () => (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
        {/* Your existing screens */}
        <AppStack.Screen name="Main" component={AppTabs} />
        <AppStack.Screen name="VaultHunt" component={VaultHuntScreen} />
        <AppStack.Screen name="Reward" component={RewardScreen} />
        
        {/* --- 2. ADD THE NEW SCREENS TO THE STACK --- */}
        <AppStack.Screen name="BusinessDashboard" component={BusinessDashboard} />
        <AppStack.Screen name="CreateVault" component={CreateVaultScreen} />
        <AppStack.Screen name="BusinessSetup" component={BusinessSetupScreen} />
    </AppStack.Navigator>
);


export default function App() {
  const [user, setUser]       = useState<firebase.User | null>(null);
  const [initializing, setInitializing] = useState(true);

  // === NEW STATE FOR THE LOCK SCREEN ===
  const [isBiometricsEnabled, setIsBiometricsEnabled] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);


  useEffect(() => {
    const unsub = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // User is logged in, check if they have enabled biometrics in the secure store
        const enabled = await SecureStore.getItemAsync('biometricsEnabled');
        setIsBiometricsEnabled(enabled === 'true');
        // If biometrics are NOT enabled, we can consider the app "unlocked" by default
        if (enabled !== 'true') {
            setIsUnlocked(true);
        }
      } else {
        // User logged out, reset everything
        setIsBiometricsEnabled(false);
        setIsUnlocked(false);
      }
      
      setInitializing(false);
    });
    return unsub;
  }, []);

  // Show a full-screen loading indicator while Firebase initializes
  if (initializing) {
    return (
        <View style={styles.container}>
            <ActivityIndicator size="large" />
        </View>
    );
  }

  // --- Main Render Logic ---
  
  // 1. If the user is logged in...
  if (user) {
    // ... and they have biometrics enabled, but haven't unlocked...
    if (isBiometricsEnabled && !isUnlocked) {
      // NOTE: Gesture handler also needs to wrap the LockScreen if it has gestures. It's safe to wrap it.
      return (
        <GestureHandlerRootView style={{ flex: 1 }}>
          <LockScreen onUnlock={() => setIsUnlocked(true)} />
        </GestureHandlerRootView>
      );
    }
    // ... otherwise, show the main app...
    return (
      <GestureHandlerRootView style={{ flex: 1 }}>
        <NavigationContainer>
          <AppStackScreens />
        </NavigationContainer>
      </GestureHandlerRootView>
    );
  }
  
  // 2. If the user is NOT logged in, show the authentication flow.
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <AuthStackScreens />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
});