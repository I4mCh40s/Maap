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
import theme from '../theme';

type BreadcrumbItem = {
  id: string; text: string; createdAt: Timestamp | null;
  lat: number; lng: number; trailIds?: string[];
};
type Trail = { 
  id: string; name: string; breadcrumbCount: number; 
};

export default function ProfileScreen({ navigation }: any) {
  const insets = useSafeAreaInsets();
  const user = auth.currentUser;
  const uid = user?.uid;

  // --- STATE ---
  const [allBreadcrumbs, setAllBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [trails, setTrails] = useState<Trail[]>([]);
  const [selectedTrail, setSelectedTrail] = useState<Trail | null>(null);
  const [breadcrumbsInSelectedTrail, setBreadcrumbsInSelectedTrail] = useState<BreadcrumbItem[]>([]);
  const [isListDetailLoading, setIsListDetailLoading] = useState(false);
  const [isCreateTrailModalVisible, setCreateTrailModalVisible] = useState(false);
  const [newTrailName, setNewTrailName] = useState('');
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ isVerified: boolean; isMerchant: boolean; photoURL?: string | null; }>({ isVerified: false, isMerchant: false });
  const [isEditModalVisible, setEditModalVisible] = useState(false);
  const [trailNameToEdit, setTrailNameToEdit] = useState('');

  // --- DATA FETCHING ---
  useEffect(() => {
    if (!uid) return;
    const ref = doc(db, 'users', uid);
    const unsub = onSnapshot(ref, snap => { if (snap.exists()) { const d = snap.data(); setProfile({ isVerified: !!d.isVerified, isMerchant: !!d.isMerchant, photoURL: d.photoURL ?? null }); } });
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) { setAllBreadcrumbs([]); setLoading(false); return; }
    const q = query(collection(db, 'pins'), where('ownerId', '==', uid), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
        const items = snap.docs.map(d => { const data = d.data(); return { id: d.id, text: data.text as string, createdAt: data.createdAt as Timestamp, lat: data.location.latitude, lng: data.location.longitude, trailIds: data.listIds || [] }; });
        setAllBreadcrumbs(items); setLoading(false);
    });
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!uid) { setTrails([]); return; }
    const q = query(collection(db, 'pin_lists'), where('ownerId', '==', uid), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, snap => {
        const lists = snap.docs.map(d => ({ id: d.id, name: d.data().name, breadcrumbCount: 0 }));
        setTrails(lists);
    });
    return unsub;
  }, [uid]);

  useEffect(() => {
    if (!selectedTrail || !uid) { setBreadcrumbsInSelectedTrail([]); return; };
    setIsListDetailLoading(true);
    if (selectedTrail.id === 'all_breadcrumbs') { setBreadcrumbsInSelectedTrail(allBreadcrumbs); setIsListDetailLoading(false); return; }
    const q = query(collection(db, 'pins'), where('ownerId', '==', uid), where('listIds', 'array-contains', selectedTrail.id), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, snap => {
        const items = snap.docs.map(d => { const data = d.data(); return { id: d.id, text: data.text as string, createdAt: data.createdAt as Timestamp, lat: data.location.latitude, lng: data.location.longitude, trailIds: data.trailIds }; });
        setBreadcrumbsInSelectedTrail(items); setIsListDetailLoading(false);
    });
    return unsub;
  }, [selectedTrail, uid, allBreadcrumbs]);
  
  // --- HANDLERS ---
  const handleFlyToBreadcrumb = (item: BreadcrumbItem) => navigation.navigate('Map', { flyToCoords: { lat: item.lat, lng: item.lng } });
  const handleCreateTrail = async () => { if (!newTrailName.trim() || !uid) return; try { await addDoc(collection(db, 'pin_lists'), { ownerId: uid, name: newTrailName.trim(), createdAt: serverTimestamp() }); setNewTrailName(''); setCreateTrailModalVisible(false); } catch (error) { Alert.alert('Error', 'Could not create Trail.'); } };
  const handleRenameTrail = async () => { if (!selectedTrail || !trailNameToEdit.trim()) return; const trailRef = doc(db, 'pin_lists', selectedTrail.id); try { await updateDoc(trailRef, { name: trailNameToEdit.trim() }); setEditModalVisible(false); setSelectedTrail(prev => prev ? { ...prev, name: trailNameToEdit.trim() } : null); } catch (error) { console.error("Error renaming Trail: ", error); Alert.alert('Error', 'Could not rename Trail.'); } };
  const handleDeleteTrail = async () => { if (!selectedTrail) return; try { await deleteDoc(doc(db, 'pin_lists', selectedTrail.id)); setEditModalVisible(false); setSelectedTrail(null); } catch (error) { console.error("Error deleting Trail: ", error); Alert.alert('Error', 'Could not delete Trail.'); } };
  const confirmDeleteTrail = () => Alert.alert( "Delete Trail", `Are you sure you want to delete "${selectedTrail?.name}"?`, [ { text: "Cancel", style: "cancel" }, { text: "Delete", style: "destructive", onPress: handleDeleteTrail } ]);
  const openEditModal = () => { if (!selectedTrail) return; setTrailNameToEdit(selectedTrail.name); setEditModalVisible(true); };
  const handleLogout = async () => { try { await signOut(auth); } catch (e: any) { Alert.alert('Logout failed', e.message); } }
  
  const combinedTrails = useMemo(() => { const counts: { [key: string]: number } = {}; for (const breadcrumb of allBreadcrumbs) { if (breadcrumb.trailIds) { for (const trailId of breadcrumb.trailIds) { counts[trailId] = (counts[trailId] || 0) + 1; } } } const listsWithCounts = trails.map(list => ({ ...list, breadcrumbCount: counts[list.id] || 0 })); return [{ id: 'all_breadcrumbs', name: 'All Breadcrumbs', breadcrumbCount: allBreadcrumbs.length }, ...listsWithCounts]; }, [allBreadcrumbs, trails]);

  const renderBreadcrumbItem = ({ item }: { item: BreadcrumbItem }) => (
    <TouchableOpacity style={styles.breadcrumbCard} onPress={() => handleFlyToBreadcrumb(item)}>
        <View style={styles.breadcrumbCardIconContainer}>
            <MaterialCommunityIcons name="map-marker-outline" size={24} color={theme.colors.lightGrey} />
        </View>
        <View style={{ flex: 1, marginRight: theme.spacing.sm }}>
            <Text style={styles.breadcrumbCardText} numberOfLines={1}>{item.text}</Text>
        </View>
        <View>
            <Text style={styles.breadcrumbCardDate}>
                {item.createdAt?.toDate().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) || ''}
            </Text>
        </View>
    </TouchableOpacity>
  );
  
  // --- THIS IS THE CORRECTED RENDER FUNCTION ---
  const renderTrailItem = ({ item }: { item: Trail }) => (
    <TouchableOpacity style={styles.listItem} onPress={() => setSelectedTrail(item)}>
        <View style={styles.listItemIconContainer}>
            <MaterialCommunityIcons name="shoe-print" size={24} color={theme.colors.lightGrey} />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={styles.listItemTitle}>{item.name}</Text>
            {/* Using a template literal `` to create a single string expression */}
            <Text style={styles.listItemSubtitle}>
                {`${item.breadcrumbCount} ${item.breadcrumbCount === 1 ? 'breadcrumb' : 'breadcrumbs'}`}
            </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color={theme.colors.mediumGrey} />
    </TouchableOpacity>
  );

  // --- Main Render ---
  return (
    <SafeAreaView style={styles.safe}>
      {selectedTrail ? (
        <View style={styles.detailViewContainer}>
          <View style={[styles.detailHeader, { paddingTop: insets.top }]}>
            <TouchableOpacity onPress={() => setSelectedTrail(null)} style={styles.backButton}><MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.white} /></TouchableOpacity>
            <Text style={styles.detailTitle}>{selectedTrail.name}</Text>
            {selectedTrail.id !== 'all_breadcrumbs' ? <TouchableOpacity onPress={openEditModal} style={styles.editButton}><MaterialCommunityIcons name="pencil-outline" size={24} color={theme.colors.primary} /></TouchableOpacity> : <View style={styles.editButton} />}
          </View>
          {isListDetailLoading ? <ActivityIndicator style={{ marginTop: 40 }} color={theme.colors.primary} /> : (
            <FlatList data={breadcrumbsInSelectedTrail} renderItem={renderBreadcrumbItem} keyExtractor={item => item.id} contentContainerStyle={styles.listContainer} ListEmptyComponent={<Text style={styles.noItems}>No breadcrumbs in this trail yet.</Text>} />
          )}
        </View>
      ) : (
        <>
          <View style={[styles.headerContainer, { paddingTop: insets.top }]}>
            <View style={styles.titleRow}>
              <Text style={styles.title}>Your Trails</Text>
              <TouchableOpacity onPress={handleLogout}><MaterialCommunityIcons name="logout" size={26} color={theme.colors.lightGrey} /></TouchableOpacity>
            </View>
            <View style={styles.headerRow}>
              {profile.photoURL ? (<Image source={{ uri: profile.photoURL }} style={styles.avatar} />) : (<View style={styles.avatarPlaceholder}><Text style={styles.avatarText}>{(user?.displayName ?? 'M').charAt(0)}</Text></View>)}
              <View style={{ marginLeft: theme.spacing.md, flex: 1 }}>
                <Text style={styles.displayName}>{user?.displayName ?? 'Maap'}</Text>
                <Text style={styles.email} numberOfLines={1}>{user?.email ?? ''}</Text>
              </View>
              <TouchableOpacity onPress={() => setCreateTrailModalVisible(true)}>
                <MaterialCommunityIcons name="plus-circle-outline" size={32} color={theme.colors.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={combinedTrails}
              renderItem={renderTrailItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContainer}
              ListEmptyComponent={<Text style={styles.noItems}>Drop a breadcrumb on the map to start your first Trail!</Text>}
            />
          )}
        </>
      )}

      {/* --- Modals --- */}
      <Modal visible={isCreateTrailModalVisible} transparent animationType="fade">
          <View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>Create New Trail</Text><TextInput style={styles.modalInput} placeholder="Trail name..." placeholderTextColor={theme.colors.lightGrey} value={newTrailName} onChangeText={setNewTrailName} /><View style={styles.modalActionsRow}><TouchableOpacity style={styles.modalButton} onPress={() => setCreateTrailModalVisible(false)}><Text style={styles.modalButtonText}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[styles.modalButton, styles.modalConfirmButton]} onPress={handleCreateTrail}><Text style={styles.modalConfirmButtonText}>Create</Text></TouchableOpacity></View></View></View>
      </Modal>
      <Modal visible={isEditModalVisible} transparent animationType="fade">
          <View style={styles.modalBackdrop}><View style={styles.modalCard}><Text style={styles.modalTitle}>Edit Trail</Text><TextInput style={styles.modalInput} value={trailNameToEdit} onChangeText={setTrailNameToEdit} placeholderTextColor={theme.colors.lightGrey} /><View style={styles.modalActionsRow}><TouchableOpacity style={styles.modalButton} onPress={() => setEditModalVisible(false)}><Text style={styles.modalButtonText}>Cancel</Text></TouchableOpacity><TouchableOpacity style={[styles.modalButton, styles.modalConfirmButton]} onPress={handleRenameTrail}><Text style={styles.modalConfirmButtonText}>Save</Text></TouchableOpacity></View><TouchableOpacity style={styles.deleteButton} onPress={confirmDeleteTrail}><Text style={styles.deleteButtonText}>Delete Trail</Text></TouchableOpacity></View></View>
      </Modal>
    </SafeAreaView>
  );
}

// --- Stylesheet ---
const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: theme.colors.black },
    headerContainer: { paddingHorizontal: theme.spacing.md, borderBottomWidth: 1, borderBottomColor: theme.colors.mediumGrey },
    titleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: theme.spacing.sm },
    title: { fontSize: theme.fontSizes.h2, fontWeight: '700', color: theme.colors.white },
    headerRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: theme.spacing.lg },
    avatar: { width: 64, height: 64, borderRadius: 32 },
    avatarPlaceholder: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.colors.mediumGrey, justifyContent: 'center', alignItems: 'center' },
    avatarText: { fontSize: 32, color: theme.colors.white, fontWeight: '500' },
    displayName: { fontSize: theme.fontSizes.h3, fontWeight: 'bold', color: theme.colors.white },
    email: { fontSize: theme.fontSizes.body, color: theme.colors.lightGrey, marginTop: theme.spacing.xs },
    noItems: { fontSize: 16, color: theme.colors.lightGrey, textAlign: 'center', marginTop: 40, paddingHorizontal: 20 },
    listContainer: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.md, paddingBottom: 100 },
    listItem: { backgroundColor: theme.colors.darkGrey, borderRadius: 16, padding: theme.spacing.md, flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm },
    listItemIconContainer: { width: 48, height: 48, borderRadius: 12, backgroundColor: theme.colors.mediumGrey, justifyContent: 'center', alignItems: 'center', marginRight: theme.spacing.md },
    listItemTitle: { fontSize: theme.fontSizes.body, fontWeight: '600', color: theme.colors.white },
    listItemSubtitle: { fontSize: theme.fontSizes.caption, color: theme.colors.lightGrey, marginTop: theme.spacing.xs },
    detailViewContainer: { flex: 1, backgroundColor: theme.colors.black },
    detailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: theme.spacing.sm, paddingBottom: theme.spacing.md, backgroundColor: theme.colors.black, borderBottomWidth: 1, borderBottomColor: theme.colors.mediumGrey },
    detailTitle: { fontSize: theme.fontSizes.h3, fontWeight: 'bold', color: theme.colors.white },
    backButton: { padding: theme.spacing.sm, width: 50 },
    editButton: { padding: theme.spacing.sm, width: 50, alignItems: 'flex-end' },
    breadcrumbCard: { backgroundColor: theme.colors.darkGrey, borderRadius: 16, padding: theme.spacing.md, flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.sm },
    breadcrumbCardIconContainer: { width: 48, height: 48, borderRadius: 12, backgroundColor: theme.colors.mediumGrey, justifyContent: 'center', alignItems: 'center', marginRight: theme.spacing.md },
    breadcrumbCardText: { flex: 1, fontSize: theme.fontSizes.body, color: theme.colors.white },
    breadcrumbCardDate: { fontSize: theme.fontSizes.caption, color: theme.colors.lightGrey },
    modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
    modalCard: { width: '90%', backgroundColor: theme.colors.darkGrey, borderRadius: 16, padding: theme.spacing.lg },
    modalTitle: { fontSize: theme.fontSizes.h3, fontWeight: '600', marginBottom: theme.spacing.lg, textAlign: 'center', color: theme.colors.white },
    modalInput: { backgroundColor: theme.colors.black, color: theme.colors.white, borderWidth: 1, borderColor: theme.colors.mediumGrey, borderRadius: 12, padding: theme.spacing.md, marginBottom: theme.spacing.xl, fontSize: theme.fontSizes.body },
    modalActionsRow: { flexDirection: 'row', justifyContent: 'space-between', gap: theme.spacing.md },
    modalButton: { flex: 1, padding: theme.spacing.md, alignItems: 'center', borderRadius: 12, backgroundColor: theme.colors.mediumGrey },
    modalButtonText: { color: theme.colors.white, fontWeight: 'bold' },
    modalConfirmButton: { backgroundColor: theme.colors.primary },
    modalConfirmButtonText: { color: theme.colors.black, fontWeight: 'bold' },
    deleteButton: { marginTop: theme.spacing.md, backgroundColor: theme.colors.danger, padding: theme.spacing.md, alignItems: 'center', borderRadius: 12 },
    deleteButtonText: { color: theme.colors.white, fontWeight: 'bold' },
});