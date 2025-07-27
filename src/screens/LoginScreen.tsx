// src/screens/LoginScreen.tsx
import React, { useState } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator
} from 'react-native';
import shared from '../components/SharedStyles'
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { auth } from '../firebase';
import { signInWithEmailAndPassword } from 'firebase/auth'; // Import the v9 function

type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};
type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false); // Add a loading state for better UX

  const onLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter your email and password.');
      return;
    }

    setLoading(true);
    try {
      // Use the modular v9 function
      await signInWithEmailAndPassword(auth, email, password);
      
      // onAuthStateChanged in App.tsx will handle navigation,
      // but we now check if we should prompt for biometrics.
      
      // === NEW LOGIC STARTS HERE ===
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (hasHardware && isEnrolled) {
        Alert.alert(
          "Enable Biometric Sign-In?",
          "Use your fingerprint or face to sign in faster next time.",
          [
            {
              text: "Yes, Enable",
              onPress: async () => {
                await SecureStore.setItemAsync('biometricsEnabled', 'true');
                console.log("Biometrics enabled by user.");
              },
            },
            {
              text: "No, Thanks",
              style: "cancel",
              onPress: () => console.log("User declined biometrics."),
            },
          ]
        );
      }
      // === NEW LOGIC ENDS HERE ===

    } catch (e: any) {
      Alert.alert('Login failed', e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome back</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      
      <TouchableOpacity style={shared.button} onPress={onLogin} disabled={loading}>
        {loading ? <ActivityIndicator color="white" /> : <Text style={shared.buttonText}>Log In</Text>}
      </TouchableOpacity>
      
      <TouchableOpacity
        style={[shared.button, { backgroundColor: '#AAA' }]}
        onPress={() => navigation.navigate('Signup')}
      >
        <Text style={shared.buttonText}>Create Account</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  //... Your existing styles are fine
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#FFF', },
  title: { fontSize: 24, textAlign: 'center', marginBottom: 32, },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, padding: 12, marginBottom: 12, fontSize: 16 },
});