// App.tsx
import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

import { auth } from './src/firebase';

// --- your screens ---
import OnboardingScreen from './src/screens/OnboardingScreen';
import LoginScreen      from './src/screens/LoginScreen';
import SignupScreen     from './src/screens/SignupScreen';
import AppTabs          from './src/navigation/AppTabs';

// --- define the shape of your auth stack routes ---
export type AuthStackParamList = {
  Onboarding: undefined;
  Login:      undefined;
  Signup:     undefined;
};

// for typings if you ever need them:
type OnboardingProps = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;
// type LoginProps      = NativeStackScreenProps<AuthStackParamList, 'Login'>;
// type SignupProps     = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack  = createNativeStackNavigator();

export default function App() {
  const [user, setUser]       = useState<firebase.User | null>(null);
  const [loading, setLoading] = useState(true);

  // listen to Firebase auth state
  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => {
      setUser(u);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // you could show a splash screen here
  if (loading) return null;

  return (
    <SafeAreaProvider>
    <NavigationContainer>
      {user ? (
        // --- logged in: show your bottom tabs ---
        <AppStack.Navigator screenOptions={{ headerShown: false }}>
          <AppStack.Screen name="Main" component={AppTabs} />
        </AppStack.Navigator>
      ) : (
        // --- not logged in: onboarding → login / signup ---
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
