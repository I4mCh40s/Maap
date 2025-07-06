// src/screens/SignupScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from 'react-native';
import {                // ⇠ make sure these are in your imports
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { auth } from '../firebase'
import { db } from '../firebase';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import shared from '../components/SharedStyles'

type AuthStackParamList = {
Login: undefined;
Signup: undefined;
};
type Props = NativeStackScreenProps<AuthStackParamList, 'Signup'>;

export default function SignupScreen({ navigation }: Props) {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const onSignup = async () => {
  try {
    // 1️⃣  create auth account
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const { user } = cred;
    if (!user) throw new Error("No user returned from signup.");

    // 2️⃣  save displayName to auth profile
    await updateProfile(user, { displayName });

    // 3️⃣  create Firestore profile document
    await setDoc(
      doc(db, "users", user.uid),
      {
        displayName,          // visible name in the app
        email,                // email address
        isVerified: false,    // new users are NOT verified by default
        lastSpinAt: null,     // track daily-spin timestamp
        powerUp: null,        // current power-up in inventory
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (e: any) {
    Alert.alert("Signup failed", e.message);
  }
};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create an account</Text>
      <TextInput
        style={styles.input}
        placeholder="Name"
        value={displayName}
        onChangeText={setDisplayName}
      />
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
      <TouchableOpacity style={shared.button} onPress={onSignup}>
        <Text style={shared.buttonText}>Sign Up</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[shared.button, { backgroundColor: '#005BBB' }]}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={shared.buttonText}>Have an account? Log in</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  title: {
    fontSize: 24,
    textAlign: 'center',
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
});