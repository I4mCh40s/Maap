// App.tsx
import React, { useEffect, useState } from 'react';
import { NavigationContainer }        from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackScreenProps,
} from '@react-navigation/native-stack';
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

import { auth } from './src/firebase';

// Auth screens
import LoginScreen  from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';

// Main app tabs
import AppTabs      from './src/navigation/AppTabs';

// ----- Type definitions for your auth stack -----
type AuthStackParamList = {
  Login:  undefined;
  Signup: undefined;
};

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const AppStack  = createNativeStackNavigator();

export default function App() {
  // 1) Track the signed-in user
  const [user, setUser]     = useState<firebase.User | null>(null);
  const [loading, setLoading] = useState(true);

  // 2) Subscribe to auth state changes
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(u => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // 3) You can show a splash screen here if you like
  if (loading) return null;

  return (
    <NavigationContainer>
      {user ? (
        <AppStack.Navigator screenOptions={{ headerShown: false }}>
          {/* Once logged in, your bottom tabs live under "Main" */}
          <AppStack.Screen name="Main" component={AppTabs} />
        </AppStack.Navigator>
      ) : (
        <AuthStack.Navigator screenOptions={{ headerShown: false }}>
          {/* Unauthenticated flow */}
          <AuthStack.Screen name="Login"  component={LoginScreen} />
          <AuthStack.Screen name="Signup" component={SignupScreen}/>
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}
