// src/screens/SignupScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { auth } from '../firebase'
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';

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
  lastSpinAt:     null,
  });
  } catch (e: any) {
   Alert.alert('Signup failed', e.message);
 }
 };

return (
<View style={styles.container}>
<Text style={styles.title}>Create an account</Text>
<TextInput style={styles.input} placeholder="Name" value={displayName} onChangeText={setDisplayName} />
<TextInput style={styles.input} placeholder="Email" keyboardType="email-address" autoCapitalize="none" value={email} onChangeText={setEmail} />
<TextInput style={styles.input} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} />
<Button title="Sign up" onPress={onSignup} />
<Button
title="Have an account? Log in"
onPress={() => navigation.navigate('Login')}
/>
</View>
);
}

const styles = StyleSheet.create({
container: { flex: 1, justifyContent: 'center', padding: 16 },
title: { fontSize: 24, marginBottom: 16, textAlign: 'center' },
input: {
borderWidth: 1,
borderColor: '#CCC',
borderRadius: 8,
padding: 8,
marginBottom: 12,
},
});