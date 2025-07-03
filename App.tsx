// App.tsx
import React, { useEffect, useState } from 'react';
import { StatusBar }                   from 'react-native';
import { NavigationContainer }         from '@react-navigation/native';
import { createNativeStackNavigator, NativeStackScreenProps } from '@react-navigation/native-stack';

import { SafeAreaProvider }            from 'react-native-safe-area-context';
import { PowerUpProvider }             from './src/contexts/PowerUpContext';
import { auth }                        from './src/firebase';
import firebase from 'firebase/compat/app'
import 'firebase/compat/auth'
import OnboardingScreen                from './src/screens/OnboardingScreen';
import LoginScreen                     from './src/screens/LoginScreen';
import SignupScreen                    from './src/screens/SignupScreen';
import AppTabs                         from './src/navigation/AppTabs';
import SpinScreen from './src/screens/SpinScreen'

// ─── 1. Define your Auth stack’s param list ──────────────────────────
type AuthStackParamList = {
  Onboarding: undefined;
  Login:      undefined;
  Signup:     undefined;
};

// 2. Create the navigators with those generics
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack  = createNativeStackNavigator();

export default function App() {
  // 3. Type your user state correctly
  const [user, setUser] = useState<firebase.User | null>(null)
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = auth.onAuthStateChanged(u => {
      setUser(u);
      setLoading(false);
    });
    return unsub;
  }, []);

  if (loading) return null; // or a splash screen

  return (
    <SafeAreaProvider>
      <PowerUpProvider>
        <StatusBar
          translucent
          backgroundColor="transparent"
          barStyle="dark-content"
        />

        <NavigationContainer>
          {user ? (
            <AppStack.Navigator screenOptions={{ headerShown: false }}>
              <AppStack.Screen name="Main"  component={AppTabs}  />
              <AppStack.Screen
                name="PowerUp"
                component={SpinScreen}
                options={{ presentation: 'modal' }}
              />
            </AppStack.Navigator>
          ) : (
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
      </PowerUpProvider>
    </SafeAreaProvider>
  );
}
