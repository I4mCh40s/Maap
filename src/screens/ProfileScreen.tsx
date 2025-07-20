// src/screens/ProfileScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore';

type PublicItem = {
  id: string;
  text: string;
  createdAt: Timestamp | null;
  expiresAt: Timestamp;
  likeCount: number;
  type: 'shout' | 'spot';
};

type PinItem = {
  id: string;
  text: string;
  createdAt: Timestamp | null;
};

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const user = auth.currentUser;
  const uid = user?.uid;

  const [activeTab, setActiveTab] = useState<'pins' | 'shouts'>('pins');
  const [publicItems, setPublicItems] = useState<PublicItem[]>([]);
  const [pins, setPins] = useState<PinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [profile, setProfile] = useState<{
    isVerified: boolean;
    isMerchant: boolean;
    photoURL?: string | null;
  }>({ isVerified: false, isMerchant: false });

  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, 'users', uid);
    const unsub = onSnapshot(ref, snap => {
      if (snap.exists()) {
        const d = snap.data();
        setProfile({ isVerified: !!d.isVerified, isMerchant: !!d.isMerchant, photoURL: d.photoURL ?? null });
      }
    });
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const q = query(collection(db, 'public_items'), where('ownerId', '==', uid), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
        const items = snap.docs.map(d => {
          const data = d.data();
          return { id: d.id, text: data.text as string, createdAt: data.createdAt as Timestamp, expiresAt: data.expiresAt as Timestamp, likeCount: data.likeCount as number, type: data.type as 'shout' | 'spot' };
        });
        setPublicItems(items);
        if(loading) setLoading(false);
      }, err => { console.error("Error fetching public items:", err); setFetchError('Could not load your public posts'); setLoading(false); }
    );
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) { setLoading(false); return; }
    const q = query(collection(db, 'pins'), where('ownerId', '==', uid), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
        const items = snap.docs.map(d => ({ id: d.id, text: d.data().text as string, createdAt: d.data().createdAt as Timestamp }));
        setPins(items);
        if(loading) setLoading(false);
      }, err => { console.error("Error fetching pins:", err); setFetchError('Could not load your pins'); setLoading(false); }
    );
    return unsub;
  }, [uid]);


  async function handleLogout() {
    try { await signOut(auth); } catch (e: any) { Alert.alert('Logout failed', e.message); }
  }

  const renderPublicItem = ({ item }: { item: PublicItem }) => {
    const minutesLeft = item.expiresAt ? Math.max(0, Math.ceil((item.expiresAt.toMillis() - Date.now()) / 60000)) : 0;
    return (
      <View style={styles.card}>
        <Text style={styles.cardText}>{item.text}</Text>
        <View style={styles.cardMeta}>
          <Text style={styles.cardDate}>{item.createdAt?.toDate().toLocaleDateString()}</Text>
          <Text style={styles.cardExpiry}>Expires in {minutesLeft} min</Text>
        </View>
        <View style={styles.cardFooter}>
          <Text style={styles.cardLikes}>❤️ {item.likeCount}</Text>
          <TouchableOpacity style={styles.deleteButton} onPress={() => deleteDoc(doc(db, 'public_items', item.id))}>
            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#E53935" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderPinItem = ({ item }: { item: PinItem }) => {
    return (
      <View style={styles.pinCard}>
        <Text style={styles.cardText}>{item.text}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.cardDate}>{item.createdAt?.toDate().toLocaleDateString()}</Text>
          <TouchableOpacity style={styles.deleteButton} onPress={() => deleteDoc(doc(db, 'pins', item.id))}>
            <MaterialCommunityIcons name="trash-can-outline" size={20} color="#999" />
          </TouchableOpacity>
        </View>
      </View>
    );
  };
  
  return (
    <SafeAreaView style={styles.safe}>
      <View style={[styles.headerContainer, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Your Profile</Text>
        <View style={styles.headerRow}>
          {profile.photoURL ? (<Image source={{ uri: profile.photoURL }} style={styles.avatar} />) : (<View style={styles.avatarPlaceholder}><Text style={styles.avatarText}>{(user?.displayName ?? '?').charAt(0)}</Text></View>)}
          <View style={{ marginLeft: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.displayName}>{user?.displayName ?? '—'}</Text>
              {profile.isMerchant ? (<MaterialCommunityIcons name="storefront" size={18} color="#FF7043" style={styles.badgeIcon} />) : profile.isVerified ? (<MaterialCommunityIcons name="check-decagram" size={18} color="#3BAEFC" style={styles.badgeIcon} />) : null}
            </View>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}><Text style={styles.logoutText}>Log Out</Text></TouchableOpacity>
      
        <View style={styles.segmentedControlContainer}>
          <TouchableOpacity
            style={[styles.segmentButton, activeTab === 'pins' && styles.segmentButtonActive]}
            onPress={() => setActiveTab('pins')}
          >
            <Text style={[styles.segmentButtonText, activeTab === 'pins' && styles.segmentButtonTextActive]}>My Pins</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.segmentButton, activeTab === 'shouts' && styles.segmentButtonActive]}
            onPress={() => setActiveTab('shouts')}
          >
            <Text style={[styles.segmentButtonText, activeTab === 'shouts' && styles.segmentButtonTextActive]}>My Shouts</Text>
          </TouchableOpacity>
        </View>
      </View>
      
      {loading ? (<ActivityIndicator size="large" style={{ marginTop: 40 }} />) : (
        <View style={{ flex: 1 }}>
          {activeTab === 'pins' ? (
            <FlatList data={pins} renderItem={renderPinItem} keyExtractor={item => item.id} contentContainerStyle={styles.listContainer} ListEmptyComponent={<Text style={styles.noShouts}>You haven’t created any private pins.</Text>} />
          ) : (
            <FlatList data={publicItems} renderItem={renderPublicItem} keyExtractor={item => item.id} contentContainerStyle={styles.listContainer} ListEmptyComponent={<Text style={styles.noShouts}>You haven’t posted any public items.</Text>} />
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F2F5F8' },
  headerContainer: { paddingHorizontal: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EAEAEA' },
  listContainer: { paddingHorizontal: 16, paddingVertical: 16, flexGrow: 1 },
  title: { fontSize: 28, fontWeight: '700', marginBottom: 24, textAlign: 'center', color: '#333' },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarPlaceholder: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#EEE', alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, color: '#555' },
  displayName: { fontSize: 18, fontWeight: '600', color: '#222' },
  badgeIcon: { marginLeft: 6 },
  email: { fontSize: 14, color: '#666' },
  logoutButton: { marginBottom: 16, backgroundColor: '#E53935', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  logoutText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  noShouts: { fontSize: 16, color: '#777', textAlign: 'center', marginTop: 40 },
  card: { backgroundColor: '#FFF', borderRadius: 8, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2 },
  pinCard: { backgroundColor: '#FFF', borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#EAEAEA' },
  cardText: { fontSize: 16, marginBottom: 12, color: '#222', lineHeight: 22 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardDate: { color: '#666', fontSize: 12 },
  cardLikes: { fontSize: 14, color: '#E53935', fontWeight: '500' },
  cardExpiry: { color: '#E53935', fontSize: 12, fontStyle: 'italic' },
  deleteButton: { padding: 4 },
  segmentedControlContainer: {
    flexDirection: 'row',
    backgroundColor: '#EAEAEA',
    borderRadius: 8,
    marginVertical: 8,
  },
  segmentButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentButtonActive: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 3,
    // *** BUG FIX STARTS HERE ***
    // This lifts the active button above its siblings, making the shadow visible.
    zIndex: 1,
    // *** BUG FIX ENDS HERE ***
  },
  segmentButtonText: {
    fontWeight: '600',
    fontSize: 14,
    color: '#666',
  },
  segmentButtonTextActive: {
    color: '#1976FF',
  },
});