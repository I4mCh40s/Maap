import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { doc, getDoc, setDoc, updateDoc, collection } from 'firebase/firestore';
import { signOut } from 'firebase/auth';
import { db, auth } from '../firebase';
import { UserProfile } from '../core/types';
import theme from '../theme';

// Define the navigation prop type for type safety
type ProfileScreenNavigationProp = {
  navigate: (screen: string, params?: any) => void;
};

const ProfileScreen = () => {
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const uid = auth.currentUser?.uid;

  // Fetch user profile from Firestore
  useEffect(() => {
    if (!uid) return;

    const fetchUserProfile = async () => {
      setLoading(true);
      const userDocRef = doc(db, 'users', uid);
      const docSnap = await getDoc(userDocRef);

      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      } else {
        // This case handles users who signed up before the profile creation was in place
        console.log('No user profile found, creating one.');
        // You might want a more robust profile creation flow
      }
      setLoading(false);
    };

    fetchUserProfile();
  }, [uid]);

  // Function to handle becoming a business
  const handleBecomeCreator = () => {
    // No more Alert, just navigate directly to the setup flow.
    navigation.navigate('BusinessSetup'); 
};
  
  const handleLogout = () => {
    signOut(auth);
  };

  if (loading) {
    return <View style={styles.container}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      <Text style={styles.email}>{auth.currentUser?.email}</Text>

      {userProfile?.isBusiness ? (
        <TouchableOpacity 
          style={styles.button}
          onPress={() => navigation.navigate('BusinessDashboard', { businessId: userProfile.businessId })}
        >
          <Text style={styles.buttonText}>Manage My Vaults</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.button} onPress={handleBecomeCreator}>
          <Text style={styles.buttonText}>Become a Creator</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={[styles.button, styles.logoutButton]} onPress={handleLogout}>
        <Text style={styles.buttonText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#1c1c1e',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  email: {
    fontSize: 16,
    color: 'grey',
    marginBottom: 40,
  },
  button: {
    backgroundColor: theme.colors.primary,
    width: '80%',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: 'white',
    fontWeight: '700',
    fontSize: 16,
  },
  logoutButton: {
      backgroundColor: '#3a3a3c',
  }
});

export default ProfileScreen;