// src/screens/ProfileScreen.tsx
import React from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  Alert,
} from 'react-native';
import { auth } from '../firebase';

export default function ProfileScreen() {
  const user = auth.currentUser;

  const handleLogout = async () => {
    try {
      // v9 compat signOut
      await auth.signOut();
      // App.tsx onAuthStateChanged will send you back to login
    } catch (e: any) {
      Alert.alert('Logout failed', e.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Profile</Text>
      <Text style={styles.label}>Name:</Text>
      <Text style={styles.value}>
        {user?.displayName ?? '–'}
      </Text>
      <Text style={styles.label}>Email:</Text>
      <Text style={styles.value}>
        {user?.email ?? '–'}
      </Text>
      <View style={styles.logout}>
        <Button
          title="Log Out"
          onPress={handleLogout}
          color="#D9534F"
        />
      </View>
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
    fontWeight: '600',
    marginBottom: 32,
    textAlign: 'center',
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    marginTop: 12,
  },
  value: {
    fontSize: 16,
    marginBottom: 8,
  },
  logout: {
    marginTop: 48,
    alignSelf: 'center',
    width: '60%',
  },
});
