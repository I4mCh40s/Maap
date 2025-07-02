// App.tsx
import React, { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';

import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { auth } from './src/firebase';

import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen      from './src/screens/LoginScreen';
import SignupScreen     from './src/screens/SignupScreen';
import AppTabs          from './src/navigation/AppTabs';

// Auth stack param types
export type AuthStackParamList = {
  Onboarding: undefined;
  Login:      undefined;
  Signup:     undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack  = createNativeStackNavigator();

export default function App() {
  const [user,    setUser]    = useState<firebase.User | null>(null);
  const [loading, setLoading] = useState(true);

  // 1) Listen to Firebase auth state
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // 2) Optional splash while we check auth
  if (loading) return null;

  return (
    <SafeAreaProvider>
      {/* 
        Make the native status bar transparent+translucent so your
        React Native UI can render _under_ it, and switch to dark
        content (so the time/battery icons are black on white).
      */}
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle="dark-content"
      />

      <NavigationContainer>
        {user ? (
          // → when signed in, show your bottom tabs
          <AppStack.Navigator screenOptions={{ headerShown: false }}>
            <AppStack.Screen name="Main" component={AppTabs} />
          </AppStack.Navigator>
        ) : (
          // → onboarding → login/signup flow
          <AuthStack.Navigator
            initialRouteName="Onboarding"
            screenOptions={{ headerShown: false }}
          >
            <AuthStack.Screen
              name="Onboarding"
              component={OnboardingScreen}
            />
            <AuthStack.Screen
              name="Login"
              component={LoginScreen}
            />
            <AuthStack.Screen
              name="Signup"
              component={SignupScreen}
            />
          </AuthStack.Navigator>
        )}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
