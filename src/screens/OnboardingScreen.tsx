// src/screens/OnboardingScreen.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  Button,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../App'; // adjust path if needed

type Props = NativeStackScreenProps<AuthStackParamList, 'Onboarding'>;

export default function OnboardingScreen({ navigation }: Props) {
  const finish = async () => {
    await AsyncStorage.setItem('hasSeenOnboarding', '1');
    navigation.replace('Login');
  };

  return (
    <View style={styles.container}>
      {/* You can swap out the image below for a real asset */}
      <Image
        source={require('../assets/onboard-illustration.png')}
        style={styles.image}
        resizeMode="contain"
      />

      <Text style={styles.title}>Welcome to Maap</Text>
      <Text style={styles.subtitle}>
        Tap the “+” button to shout your message to everyone within 500 m.  
        Replies, likes, and shares will expand your reach!
      </Text>

      <View style={styles.button}>
        <Button title="Get started" onPress={finish} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  image: {
    width: 240,
    height: 180,
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#555',
    marginBottom: 32,
    lineHeight: 22,
  },
  button: {
    width: '60%',
  },
});
