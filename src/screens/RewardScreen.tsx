// src/screens/RewardScreen.tsx

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// We'll use a library for the QR Code
import QRCode from 'react-native-qrcode-svg';

// We'll use an icon for the success state
import Icon from 'react-native-vector-icons/Ionicons';

// Import our main types
import { Vault } from '../core/types';
import  theme  from '../theme'; // Assuming you have a theme file for colors

// --- TypeScript Setup for Navigation ---
// This part is crucial for type safety. You should define your full stack in a central place like `navigation/types.ts`, but we'll define it here for clarity.
type RootStackParamList = {
  RewardScreen: { vault: Vault };
  // ... other screens in your stack
};

type RewardScreenRouteProp = RouteProp<RootStackParamList, 'RewardScreen'>;
type RewardScreenNavigationProp = NativeStackNavigationProp<RootStackParamList>;
// ----------------------------------------

const RewardScreen = () => {
  // 1. Get the data passed from the VaultHuntScreen
  const route = useRoute<RewardScreenRouteProp>();
  const { vault } = route.params;

  // 2. Get the navigation object to allow the user to go back
  const navigation = useNavigation<RewardScreenNavigationProp>();

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.card}>
          <Icon name="checkmark-circle" size={80} color='#1adf27ff' />

          <Text style={styles.title}>Vault Unlocked!</Text>
          <Text style={styles.businessName}>at {vault.businessName}</Text>

          <View style={styles.rewardContainer}>
            <Text style={styles.rewardLabel}>Your Reward:</Text>
            <Text style={styles.rewardText}>{vault.privateReward}</Text>
          </View>

          <View style={styles.redemptionContainer}>
            <Text style={styles.redeemInstructions}>
              Show this QR Code to the cashier
            </Text>
            <View style={styles.qrCodeWrapper}>
              {/* The value of the QR code is the redemption code */}
              <QRCode value={vault.redemptionCode} size={180} />
            </View>
            <Text style={styles.orText}>or use the manual code:</Text>
            <Text style={styles.manualCode}>{vault.redemptionCode}</Text>
          </View>
        </View>

        <TouchableOpacity
          style={styles.doneButton}
          onPress={() => navigation.popToTop()} // Go back to the very first screen (the map)
        >
          <Text style={styles.doneButtonText}>Done</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

// --- Styles ---
// Using a consistent theme is best practice
const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f0f2f5',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginTop: 16,
    color: '#333',
  },
  businessName: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  rewardContainer: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
    width: '100%',
    alignItems: 'center',
  },
  rewardLabel: {
    fontSize: 14,
    color: '#666',
  },
  rewardText: {
    fontSize: 22,
    fontWeight: '600',
    color: theme.colors.primary, // Using a theme color
    marginTop: 4,
    textAlign: 'center',
  },
  redemptionContainer: {
    marginTop: 24,
    width: '100%',
    alignItems: 'center',
  },
  redeemInstructions: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  qrCodeWrapper: {
    padding: 10,
    backgroundColor: 'white',
    borderRadius: 8,
    elevation: Platform.OS === 'android' ? 2 : 0, // slight elevation for android QR
  },
  orText: {
    marginVertical: 16,
    color: '#888',
  },
  manualCode: {
    fontSize: 24,
    fontWeight: 'bold',
    letterSpacing: 4,
    color: '#444',
    padding: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  doneButton: {
    marginTop: 32,
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 60,
    borderRadius: 30,
    shadowColor: theme.colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
  },
  doneButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default RewardScreen;