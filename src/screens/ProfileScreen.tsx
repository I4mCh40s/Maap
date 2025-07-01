// src/screens/ProfileScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  Button,
  StyleSheet,
  Alert,
  FlatList,
} from 'react-native';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';

type Shout = {
  id: string;
  text: string;
  createdAt: Date | null;
  likeCount: number;
};

export default function ProfileScreen() {
  const user = auth.currentUser;
  const [shouts, setShouts] = useState<Shout[]>([]);

  // Sign out handler
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e: any) {
      Alert.alert('Logout failed', e.message);
    }
  };

  // Subscribe to the user's own shouts
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'shouts'),
      where('ownerId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsub = onSnapshot(q, snapshot => {
      const items: Shout[] = snapshot.docs.map(doc => {
        const data = doc.data() as any;
        return {
          id: doc.id,
          text: data.text,
          createdAt:
            data.createdAt instanceof Timestamp
              ? data.createdAt.toDate()
              : null,
          likeCount: data.likeCount ?? 0,
        };
      });
      setShouts(items);
    }, err => {
      console.error('Failed to load user shouts:', err);
      Alert.alert('Error', 'Could not load your shouts');
    });

    return unsub;
  }, [user]);

  // Render each shout in the list
  const renderShout = ({ item }: { item: Shout }) => (
    <View style={styles.shoutRow}>
      <Text style={styles.shoutText}>{item.text}</Text>
      <View style={styles.shoutMeta}>
        <Text style={styles.shoutTime}>
          {item.createdAt
            ? item.createdAt.toLocaleString()
            : '—'}
        </Text>
        <Text style={styles.shoutLikes}>❤️ {item.likeCount}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Your Profile</Text>

      <Text style={styles.label}>Name:</Text>
      <Text style={styles.value}>{user?.displayName ?? '–'}</Text>

      <Text style={styles.label}>Email:</Text>
      <Text style={styles.value}>{user?.email ?? '–'}</Text>

      <View style={styles.logout}>
        <Button
          title="Log Out"
          onPress={handleLogout}
          color="#D9534F"
        />
      </View>

      <Text style={styles.sectionHeader}>Your Shouts</Text>
      {shouts.length === 0 ? (
        <Text style={styles.noShouts}>You haven’t posted any shouts yet.</Text>
      ) : (
        <FlatList
          data={shouts}
          keyExtractor={item => item.id}
          renderItem={renderShout}
          contentContainerStyle={styles.shoutsList}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    backgroundColor: '#FFF',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 24,
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
    marginTop: 24,
    alignSelf: 'center',
    width: '60%',
  },
  sectionHeader: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 32,
    marginBottom: 12,
  },
  noShouts: {
    fontStyle: 'italic',
    color: '#666',
  },
  shoutsList: {
    paddingBottom: 16,
  },
  shoutRow: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EEE',
    marginBottom: 12,
  },
  shoutText: {
    fontSize: 16,
    marginBottom: 8,
  },
  shoutMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shoutTime: {
    fontSize: 12,
    color: '#888',
  },
  shoutLikes: {
    fontSize: 12,
    color: '#E53935',
  },
});
