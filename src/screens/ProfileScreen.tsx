// src/screens/ProfileScreen.tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  SafeAreaView, View, Text, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, FlatList, Image, Modal, TextInput
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { auth, db } from '../firebase';
import {
  collection, query, where, onSnapshot, orderBy,
  doc, deleteDoc, Timestamp, addDoc, serverTimestamp,
  updateDoc
} from 'firebase/firestore';

type PublicItem = { id: string; text: string; createdAt: Timestamp | null; expiresAt: Timestamp; likeCount: number; type: 'shout' | 'spot'; };
type PinItem = {
  id: string;
  text: string;
  createdAt: Timestamp | null;
  lat: number;
  lng: number;
  listIds?: string[];
};
type PinList = { id: string; name: string; pinCount: number; };

export default function ProfileScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const user = auth.currentUser;
  const uid = user?.uid;

  const [activeTab, setActiveTab] = useState<'pins' | 'shouts'>('pins');
  const [publicItems, setPublicItems] = useState<PublicItem[]>([]);
  const [allPins, setAllPins] = useState<PinItem[]>([]);
  const [pinLists, setPinLists] = useState<PinList[]>([]);
  const [selectedList, setSelectedList] = useState<PinList | null>(null);
  const [pinsInSelectedList, setPinsInSelectedList] = useState<PinItem[]>([]);
  const [isListDetailLoading, setIsListDetailLoading] = useState(false);
  const [isCreateListModalVisible, setCreateListModalVisible] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ isVerified: boolean; isMerchant: boolean; photoURL?: string | null; }>({ isVerified: false, isMerchant: false });

  // NEW STATE FOR EDIT MODAL
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [listNameToEdit, setListNameToEdit] = useState('');

  // --- DATA FETCHING HOOKS ---

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
    if (!uid) { setAllPins([]); setLoading(false); return; }
    const q = query(collection(db, 'pins'), where('ownerId', '==', uid), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
        const items = snap.docs.map(d => {
            const data = d.data();
            return {
                id: d.id,
                text: data.text as string,
                createdAt: data.createdAt as Timestamp,
                lat: data.location.latitude,
                lng: data.location.longitude,
                listIds: data.listIds || []
            };
        });
        setAllPins(items);
        setLoading(false);
    });
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) { setPinLists([]); return; }
    const q = query(collection(db, 'pin_lists'), where('ownerId', '==', uid), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, snap => {
        const lists = snap.docs.map(d => ({ id: d.id, name: d.data().name, pinCount: 0 }));
        setPinLists(lists);
    });
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) { setPublicItems([]); return; }
    const q = query(collection(db, 'public_items'), where('ownerId', '==', uid), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
        const items = snap.docs.map(d => {
          const data = d.data();
          return { id: d.id, text: data.text as string, createdAt: data.createdAt as Timestamp, expiresAt: data.expiresAt as Timestamp, likeCount: data.likeCount as number, type: data.type as 'shout' | 'spot' };
        });
        setPublicItems(items);
    });
    return unsub;
  }, [uid]);
  
  useEffect(() => {
    if (!selectedList || !uid) { setPinsInSelectedList([]); return; };
    setIsListDetailLoading(true);
    if (selectedList.id === 'all_pins') {
      setPinsInSelectedList(allPins);
      setIsListDetailLoading(false);
      return;
    } 
    const q = query( collection(db, 'pins'), where('ownerId', '==', uid), where('listIds', 'array-contains', selectedList.id), orderBy('createdAt', 'desc') );
    const unsub = onSnapshot(q, snap => {
        const items = snap.docs.map(d => {
            const data = d.data();
            return { id: d.id, text: data.text as string, createdAt: data.createdAt as Timestamp, lat: data.location.latitude, lng: data.location.longitude };
        });
        setPinsInSelectedList(items);
        setIsListDetailLoading(false);
    });
    return unsub;
  }, [selectedList, uid, allPins]);

  // --- HANDLER FUNCTIONS ---

  const handleFlyToPin = (pin: PinItem) => {
    navigation.navigate('Home', { screen: 'Map', params: { flyToCoords: { lat: pin.lat, lng: pin.lng } } });
  };

  const handleCreateList = async () => {
    if (!newListName.trim() || !uid) return;
    try {
      await addDoc(collection(db, 'pin_lists'), { ownerId: uid, name: newListName.trim(), createdAt: serverTimestamp() });
      setNewListName('');
      setCreateListModalVisible(false);
    } catch (error) { Alert.alert('Error', 'Could not create list.'); }
  };

  const handleRenameList = async () => {
    if (!selectedList || !listNameToEdit.trim()) return;
    const listRef = doc(db, 'pin_lists', selectedList.id);
    try {
      await updateDoc(listRef, { name: listNameToEdit.trim() });
      setEditModalVisible(false);
      setSelectedList(prev => prev ? { ...prev, name: listNameToEdit.trim() } : null);
    } catch (error) { console.error("Error renaming list: ", error); Alert.alert('Error', 'Could not rename list.'); }
  };

  const handleDeleteList = async () => {
    if (!selectedList) return;
    try {
      await deleteDoc(doc(db, 'pin_lists', selectedList.id));
      setEditModalVisible(false);
      setSelectedList(null);
    } catch (error) { console.error("Error deleting list: ", error); Alert.alert('Error', 'Could not delete list.'); }
  };

  const confirmDelete = () => {
    Alert.alert( "Delete List", `Are you sure you want to delete "${selectedList?.name}"? Pins in this list will NOT be deleted.`,
      [ { text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: handleDeleteList } ]
    );
  };

  const openEditModal = () => {
    if (!selectedList) return;
    setListNameToEdit(selectedList.name);
    setEditModalVisible(true);
  };

  const combinedPinLists = useMemo(() => {
    const counts: { [key: string]: number } = {};
    for (const pin of allPins) {
      if (pin.listIds) {
        for (const listId of pin.listIds) {
          counts[listId] = (counts[listId] || 0) + 1;
        }
      }
    }
    const listsWithCounts = pinLists.map(list => ({ ...list, pinCount: counts[list.id] || 0 }));
    return [{ id: 'all_pins', name: 'All pins', pinCount: allPins.length }, ...listsWithCounts];
  }, [allPins, pinLists]);

  async function handleLogout() {
    try { await signOut(auth); } catch (e: any) { Alert.alert('Logout failed', e.message); }
  }

  // --- RENDER FUNCTIONS ---
  
  const renderPublicItem = ({ item }: { item: PublicItem }) => {
    const minutesLeft = item.expiresAt ? Math.max(0, Math.ceil((item.expiresAt.toMillis() - Date.now()) / 60000)) : 0;
    // Add the required 'return' statement
    return (
      <View style={styles.card}>
        <Text style={styles.cardText}>{item.text}</Text>
        <View style={styles.cardMeta}>
          <Text style={styles.cardDate}>{item.createdAt?.toDate().toLocaleDateString() || ''}</Text>
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
    // Add the required 'return' statement
    return (
      <TouchableOpacity style={styles.pinCard} onPress={() => handleFlyToPin(item)}>
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <View style={styles.listItemIconContainer}>
              <MaterialCommunityIcons name="map-marker" size={24} color="#555" />
          </View>
          <View style={{flex: 1}}>
              <Text style={styles.cardText}>{item.text}</Text>
          </View>
        </View>
        <Text style={styles.cardDate}>{item.createdAt?.toDate().toLocaleDateString() || ''}</Text>
      </TouchableOpacity>
    );
  };

  const renderPinListItem = ({ item }: { item: PinList }) => (
    <TouchableOpacity style={styles.listItem} onPress={() => setSelectedList(item)}>
        <View style={styles.listItemIconContainer}>
            <MaterialCommunityIcons name="map-marker-outline" size={24} color="#555" />
        </View>
        <View style={styles.listItemTextContainer}>
            <Text style={styles.listItemTitle}>{item.name}</Text>
            <Text style={styles.listItemSubtitle}>{item.pinCount} {item.pinCount === 1 ? 'pin' : 'pins'}</Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="#CCC" />
    </TouchableOpacity>
  );

  const TAB_BAR_OFFSET = 80;
  const PinListsView = () => (
    <FlatList
        data={combinedPinLists}
        renderItem={renderPinListItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        ListFooterComponent={(
            <TouchableOpacity style={styles.createListButton} onPress={() => setCreateListModalVisible(true)}>
                <Text style={styles.createListButtonText}>+ Create a new list</Text>
            </TouchableOpacity>
        )}
    />
  );

  
  return (
    <SafeAreaView style={[styles.safe, { paddingBottom: selectedList ? 0 : TAB_BAR_OFFSET }]}>
      {selectedList ? (
        // --- RENDER LIST DETAIL VIEW ---
        <>
          <View style={[styles.detailHeader, { paddingTop: insets.top }]}>
              <TouchableOpacity onPress={() => setSelectedList(null)} style={styles.backButton}>
                  <MaterialCommunityIcons name="arrow-left" size={24} color="#333" />
              </TouchableOpacity>
              <Text style={styles.detailTitle}>{selectedList.name}</Text>
              {selectedList.id !== 'all_pins' ? (
                  <TouchableOpacity onPress={openEditModal} style={styles.editButton}>
                      <Text style={styles.editButtonText}>Edit</Text>
                  </TouchableOpacity>
              ) : <View style={{width: 50}} /> }
          </View>
          {isListDetailLoading ? <ActivityIndicator style={{marginTop: 40}}/> : (
              <FlatList
                  data={pinsInSelectedList}
                  renderItem={renderPinItem}
                  keyExtractor={item => item.id}
                  contentContainerStyle={styles.listContainer}
                  ListEmptyComponent={<Text style={styles.noShouts}>No pins in this list yet.</Text>}
              />
          )}
        </>
      ) : (
        // --- RENDER MAIN PROFILE VIEW ---
        <>
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
              <TouchableOpacity style={[styles.segmentButton, activeTab === 'pins' && styles.segmentButtonActive]} onPress={() => setActiveTab('pins')}>
                <Text style={[styles.segmentButtonText, activeTab === 'pins' && styles.segmentButtonTextActive]}>My Pins</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.segmentButton, activeTab === 'shouts' && styles.segmentButtonActive]} onPress={() => setActiveTab('shouts')}>
                <Text style={[styles.segmentButtonText, activeTab === 'shouts' && styles.segmentButtonTextActive]}>My Shouts</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {loading ? (<ActivityIndicator size="large" style={{ marginTop: 40 }} />) : (
            <View style={{ flex: 1 }}>
              {activeTab === 'pins' ? <PinListsView /> : (
                <FlatList data={publicItems} renderItem={renderPublicItem} keyExtractor={item => item.id} contentContainerStyle={styles.listContainer} ListEmptyComponent={<Text style={styles.noShouts}>You haven’t posted any public items.</Text>} />
              )}
            </View>
          )}
        </>
      )}

      <Modal visible={isCreateListModalVisible} transparent animationType="fade">
        <View style={styles.backdrop}>
            <View style={styles.modalCard}>
                <Text style={styles.modalTitle}>Create New List</Text>
                <TextInput
                    style={styles.modalInput}
                    placeholder="List name"
                    value={newListName}
                    onChangeText={setNewListName}
                />
                <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.actionButton} onPress={() => setCreateListModalVisible(false)}><Text>Cancel</Text></TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.confirmButton]} onPress={handleCreateList}><Text style={styles.confirmButtonText}>Create</Text></TouchableOpacity>
                </View>
            </View>
        </View>
      </Modal>

      <Modal visible={isEditModalVisible} transparent animationType="fade">
          <View style={styles.backdrop}>
              <View style={styles.modalCard}>
                  <Text style={styles.modalTitle}>Edit List</Text>
                  <TextInput
                      style={styles.modalInput}
                      value={listNameToEdit}
                      onChangeText={setListNameToEdit}
                  />
                  {/* Action Row for Save/Cancel */}
                  <View style={styles.actionsRow}>
                    <TouchableOpacity style={styles.actionButton} onPress={() => setEditModalVisible(false)}>
                      <Text>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.actionButton, styles.confirmButton]} onPress={handleRenameList}>
                      <Text style={styles.confirmButtonText}>Save</Text>
                    </TouchableOpacity>
                  </View>
                  
                  {/* Destructive action button, correctly styled and positioned */}
                  <TouchableOpacity 
                    style={styles.deleteListButton} 
                    onPress={confirmDelete}
                  >
                      <Text style={styles.deleteListButtonText}>Delete List</Text>
                  </TouchableOpacity>
              </View>
          </View>
      </Modal>
      {/* *** BUG FIX ENDS HERE *** */}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFF' },
  headerContainer: { paddingHorizontal: 16, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#EAEAEA' },
  listContainer: { paddingHorizontal: 16, paddingTop: 16 },
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
  card: { backgroundColor: '#F8F8F8', borderRadius: 8, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#EAEAEA' },
  pinCard: { backgroundColor: '#FFF', borderRadius: 12, paddingVertical: 8, paddingHorizontal: 16, marginBottom: 8, borderWidth: 1, borderColor: '#F0F0F0' },
  cardText: { fontSize: 15, color: '#222', lineHeight: 20 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  cardMeta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  cardDate: { color: '#999', fontSize: 12, textAlign: 'right', marginTop: 4 },
  cardLikes: { fontSize: 14, color: '#E53935', fontWeight: '500' },
  cardExpiry: { color: '#E53935', fontSize: 12, fontStyle: 'italic' },
  deleteButton: { padding: 4 },
  segmentedControlContainer: { flexDirection: 'row', backgroundColor: '#EAEAEA', borderRadius: 8, marginVertical: 8, },
  segmentButton: { flex: 1, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', },
  segmentButtonActive: { backgroundColor: '#FFF', borderRadius: 8, shadowColor: '#000', shadowOpacity: 0.1, shadowOffset: { width: 0, height: 1 }, shadowRadius: 2, elevation: 3, zIndex: 1, },
  segmentButtonText: { fontWeight: '600', fontSize: 14, color: '#666', },
  segmentButtonTextActive: { color: '#1976FF', },
  listItem: { backgroundColor: '#FFF', flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F0F0F0' },
  listItemIconContainer: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#F5F5F5', alignItems: 'center', justifyContent: 'center', marginRight: 16, },
  listItemTextContainer: { flex: 1 },
  listItemTitle: { fontSize: 16, fontWeight: '600', color: '#333' },
  listItemSubtitle: { fontSize: 14, color: '#888', marginTop: 2 },
  createListButton: { backgroundColor: '#E53935', borderRadius: 12, paddingVertical: 16, alignItems: 'center', marginTop: 8, marginBottom: 16 },
  createListButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  detailHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#EAEAEA', backgroundColor: '#FFF', },
  detailTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: 'bold', color: '#333', },
  backButton: { padding: 8 },
  editButton: { width: 50, alignItems: 'center', justifyContent: 'center', padding: 8, },
  editButtonText: { color: '#1976FF', fontWeight: '600', fontSize: 16, },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  modalCard: { width: '90%', backgroundColor: '#FFF', borderRadius: 12, padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '600', marginBottom: 16, textAlign: 'center' },
  modalInput: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 12, marginBottom: 20 },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, gap: 8, },
  actionButton: { flex: 1,  padding: 12, alignItems: 'center', borderRadius: 8, backgroundColor: '#EEE', },
  confirmButton: { backgroundColor: '#1976FF' },
  confirmButtonText: { color: '#FFF', fontWeight: 'bold' },
  deleteListButton: {
    // This style is for a standalone button, not one in an actionsRow
    marginTop: 12, // Add space above it
    backgroundColor: '#E53935', 
    padding: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  deleteListButtonText: { 
    color: '#FFF', 
    fontWeight: 'bold' 
  },
});