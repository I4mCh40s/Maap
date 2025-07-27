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

// We keep your AppStack definition as it just holds the AppTabs
type AppStackParamList = { Main: undefined };
const AppStack  = createNativeStackNavigator<AppStackParamList>();
const AppStackScreens = () => (
    <AppStack.Navigator screenOptions={{ headerShown: false }}>
        <AppStack.Screen name="Main" component={AppTabs} />
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
    // ... and they have biometrics enabled, but haven't unlocked this session yet...
    if (isBiometricsEnabled && !isUnlocked) {
        // ... show them the lock screen.
        return <LockScreen onUnlock={() => setIsUnlocked(true)} />;
    }
    // ... otherwise (they are logged in and either don't use biometrics or have just unlocked)...
    // ... show them the main app.
    return (
        <NavigationContainer>
            <AppStackScreens />
        </NavigationContainer>
    );
  }
  
  // 2. If the user is NOT logged in, show the authentication flow.
  return (
    <NavigationContainer>
      <AuthStackScreens />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
});