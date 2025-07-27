// App.tsx
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';
import { auth } from './src/firebase';

import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen      from './src/screens/LoginScreen';
import SignupScreen     from './src/screens/SignupScreen';
import AppTabs          from './src/navigation/AppTabs';

// --- No changes needed here, this is the stack for logged-out users ---
type AuthStackParamList = {
  Onboarding: undefined;
  Login:      undefined;
  Signup:     undefined;
};
const AuthStack = createNativeStackNavigator<AuthStackParamList>();

// --- MODIFICATION 1: `PowerUp` type removed from the app stack ---
type AppStackParamList = {
  Main: undefined;
  // REMOVED: PowerUp: undefined;
};
const AppStack  = createNativeStackNavigator<AppStackParamList>();

export default function App() {
  const [user, setUser]       = useState<firebase.User | null>(null);
  const [initializing, setInitializing] = useState(true);

  // 1) Subscribe to Firebase auth state
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => {
      setUser(u);
      if (initializing) setInitializing(false);
    });
    return unsub;
  }, []);

  // Show nothing (or a splash) while we figure out if there's a user 
  if (initializing) return null;

  return (
    <NavigationContainer>
      {user ? (
        // 2) If a user exists, show the main app
        <AppStack.Navigator screenOptions={{ headerShown: false }}>
          <AppStack.Screen name="Main" component={AppTabs} />
          {/* --- MODIFICATION 2: The screen for 'PowerUp' is now deleted --- */}
          {/* 
            REMOVED:
            <AppStack.Screen
              name="PowerUp"
              component={SpinScreen}
              options={{ presentation: 'modal' }}
            /> 
          */}
        </AppStack.Navigator>
      ) : (
        // 3) Otherwise send them through Onboarding → Login/Signup
        <AuthStack.Navigator initialRouteName="Onboarding" screenOptions={{ headerShown: false }}>
          <AuthStack.Screen name="Onboarding" component={OnboardingScreen} />
          <AuthStack.Screen name="Login"      component={LoginScreen} />
          <AuthStack.Screen name="Signup"     component={SignupScreen} />
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}