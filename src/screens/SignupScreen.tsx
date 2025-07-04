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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { auth } from '../firebase'
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
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
      const cred = await auth.createUserWithEmailAndPassword(
        email,
        password
      );
      const user = cred.user;
      if (!user) throw new Error('No user returned from signup.');
      await user.updateProfile({ displayName });
      await setDoc(doc(db, 'users', user.uid), {
        displayName,
        email,
        powerUp: null,
        createdAt: new Date().toISOString(),
        lastSpinAt: null,
      });
    } catch (e: any) {
      Alert.alert('Signup failed', e.message);
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