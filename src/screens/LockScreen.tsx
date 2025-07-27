// Create a new file: src/screens/LockScreen.tsx
import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import theme from '../theme';

// The screen receives a function `onUnlock` to call when auth is successful.
export default function LockScreen({ onUnlock }: { onUnlock: () => void }) {
  
  const handleBiometricAuth = async () => {
    try {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Unlock Maap",
        disableDeviceFallback: true, // Don't allow passcode fallback
        cancelLabel: "Cancel",
      });

      if (result.success) {
        onUnlock(); // Call the function to unlock the app
      } else {
        // You could handle failed attempts here, e.g., show an error.
        console.log("Biometric auth failed or was cancelled.");
      }
    } catch (error) {
      Alert.alert("Authentication Error", "Could not verify your identity. Please restart the app.");
    }
  };

  // Attempt to authenticate automatically when the screen loads
  useEffect(() => {
    handleBiometricAuth();
  }, []);
  
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name="lock-outline" size={64} color={theme.colors.primary} />
      <Text style={styles.title}>App Locked</Text>
      <Text style={styles.subtitle}>Please verify your identity to continue.</Text>
      <TouchableOpacity style={styles.button} onPress={handleBiometricAuth}>
        <Text style={styles.buttonText}>Unlock with Biometrics</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.colors.black,
  },
  title: {
    fontSize: theme.fontSizes.h2,
    color: theme.colors.white,
    fontWeight: 'bold',
    marginTop: theme.spacing.lg,
  },
  subtitle: {
    fontSize: theme.fontSizes.body,
    color: theme.colors.lightGrey,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.xl,
  },
  button: {
    backgroundColor: theme.colors.primary,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
    borderRadius: 30,
  },
  buttonText: {
    color: theme.colors.black,
    fontSize: theme.fontSizes.body,
    fontWeight: 'bold',
  },
});