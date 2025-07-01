// src/screens/LoginScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  TouchableOpacity
} from 'react-native';
import shared from '../components/SharedStyles'
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { auth } from '../firebase';

type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
};
type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');

  const onLogin = async () => {
    try {
      // v9 compat: auth is from firebase.auth()
      await auth.signInWithEmailAndPassword(email, password);
      // App.tsx onAuthStateChanged will now switch to the main flow
    } catch (e: any) {
      Alert.alert('Login failed', e.message);
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
      <TouchableOpacity style={shared.button} onPress={onLogin}>
        <Text style={shared.buttonText}>Log In</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[shared.button, { backgroundColor: '#005BBB' }]}
        onPress={() => navigation.navigate('Signup')}
      >
        <Text style={shared.buttonText}>Create Account</Text>
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
  input:     {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
  },
});
