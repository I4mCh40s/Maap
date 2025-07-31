// src/screens/BusinessDashboard.tsx (COMPLETE FINAL VERSION 3.0)
import React, { useState, useEffect } from 'react';
import {
    View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, Switch, Alert
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { db } from '../firebase';
import { Vault } from '../core/types';
import theme from '../theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type RootStackParamList = {
    BusinessDashboard: { businessId: string };
    BusinessSetup: { isEditing: true, businessId: string };
    CreateVault: undefined;
};
type BusinessDashboardRouteProp = RouteProp<RootStackParamList, 'BusinessDashboard'>;
type BusinessDashboardNavigationProp = {
    navigate: (screen: keyof RootStackParamList, params?: any) => void;
    goBack: () => void;
};

const BusinessDashboard = () => {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<BusinessDashboardNavigationProp>();
    const route = useRoute<BusinessDashboardRouteProp>();
    const { businessId } = route.params;

    const [vaults, setVaults] = useState<Vault[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!businessId) return;
        const q = query(collection(db, 'vaults'), where('businessId', '==', businessId));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedVaults = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Vault));
            setVaults(fetchedVaults);
            setLoading(false);
        }, (error) => {
            setLoading(false);
        });
        return () => unsubscribe();
    }, [businessId]);

    const handleToggleActive = async (vault: Vault) => {
    const vaultDocRef = doc(db, 'vaults', vault.id);
    try {
        await updateDoc(vaultDocRef, { isActive: !vault.isActive });
        console.log(`Vault ${vault.id} status toggled successfully.`);
    } catch (error) {
        console.error("Firebase Error: Failed to update vault status:", error);
        Alert.alert('Error', 'Could not update the vault status. Check console for details.');
    }
};
    const handleDeleteVault = (vault: Vault) => {
    Alert.alert(
        "Delete Vault",
        `Are you sure you want to permanently delete "${vault.publicName}"? This action cannot be undone.`,
        [
            { text: "Cancel", style: "cancel" },
            { 
                text: "Delete", 
                style: "destructive",
                onPress: async () => {
                    try {
                        await deleteDoc(doc(db, 'vaults', vault.id));
                        console.log(`Vault ${vault.id} deleted successfully.`);
                    } catch (error) {
                        console.error("Firebase Error: Failed to delete vault:", error);
                        Alert.alert('Error', 'Could not delete the vault. Check console for details.');
                    }
                }
            },
        ]
    );
};

    const renderVaultItem = ({ item }: { item: Vault }) => (
        <View style={styles.vaultItem}>
            <View style={styles.vaultInfo}>
                <Text style={styles.vaultName}>{item.publicName}</Text>
                <Text style={styles.vaultReward}>"{item.privateReward}"</Text>
                <Text style={styles.vaultClaims}>{`${item.claimedQuantity || 0} / ${item.totalQuantity} Claimed`}</Text>
            </View>
            <View style={styles.vaultActions}>
                <Switch trackColor={{ false: "#3e3e3e", true: theme.colors.primary_light }} thumbColor={item.isActive ? theme.colors.primary : "#f4f3f4"} onValueChange={() => handleToggleActive(item)} value={item.isActive}/>
                <TouchableOpacity onPress={() => handleDeleteVault(item)} style={styles.deleteButton}>
                    <MaterialCommunityIcons name="trash-can-outline" size={24} color={theme.colors.danger} />
                </TouchableOpacity>
            </View>
        </View>
    );

    if (loading) {
        return <View style={[styles.container, { justifyContent: 'center'}]}><ActivityIndicator color={theme.colors.primary} /></View>;
    }
    
    return (
        <View style={styles.container}>
            <FlatList
                data={vaults}
                renderItem={renderVaultItem}
                keyExtractor={(item) => item.id}
                contentContainerStyle={{ paddingTop: insets.top + 70, paddingBottom: insets.bottom + 100, paddingHorizontal: 20 }}
                ListHeaderComponent={<Text style={styles.listHeader}>My Live Vaults</Text>}
                ListEmptyComponent={
                    <View style={styles.emptyContainer}><MaterialCommunityIcons name="treasure-chest" size={60} color="#555" /><Text style={styles.emptyText}>You haven't created any vaults yet.</Text><Text style={styles.emptySubText}>Tap the '+' button to get started!</Text></View>
                }
            />

            <View style={[styles.header, { paddingTop: insets.top }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
                    <MaterialCommunityIcons name="chevron-left" size={32} color="white" />
                </TouchableOpacity>
                <Text style={styles.title}>Dashboard</Text>
                <TouchableOpacity 
                    style={styles.editProfileButton}
                    onPress={() => navigation.navigate('BusinessSetup', { isEditing: true, businessId: businessId })}>
                    <Text style={styles.editProfileButtonText}>Edit Profile</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity style={[styles.fab, { bottom: insets.bottom + 20 }]} onPress={() => navigation.navigate('CreateVault')}>
                <MaterialCommunityIcons name="plus" size={30} color="black" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { 
        flex: 1, 
        backgroundColor: '#000000'
    },
    header: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0,0,0,0.8)', // Translucent background
        paddingHorizontal: 10,
        paddingBottom: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: '#222',
        zIndex: 10, // Ensure header is on top
    },
    headerButton: {
        padding: 5,
    },
    title: { 
        fontSize: 22,
        fontWeight: 'bold', 
        color: 'white' 
    },
    editProfileButton: {
        borderWidth: 1,
        borderColor: theme.colors.primary,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16
    },
    editProfileButtonText: {
        color: theme.colors.primary,
        fontWeight: '600'
    },
    listHeader: {
        fontSize: 22,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 20
    },
    vaultItem: {
        backgroundColor: '#1C1C1E',
        padding: 20,
        borderRadius: 16,
        marginBottom: 15,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    vaultInfo: {
        flex: 1,
        marginRight: 10,
    },
    vaultName: { fontSize: 18, color: 'white', fontWeight: '600', marginBottom: 4, },
    vaultReward: { fontSize: 14, color: 'grey', fontStyle: 'italic', marginBottom: 8, },
    vaultClaims: { fontSize: 14, color: theme.colors.primary, fontWeight: 'bold' },
    vaultActions: { alignItems: 'center' },
    deleteButton: { marginTop: 12 },
    emptyContainer: { alignItems: 'center', marginTop: 80, opacity: 0.6 },
    emptyText: { fontSize: 18, color: 'grey', marginTop: 16 },
    emptySubText: { fontSize: 14, color: '#555', marginTop: 8 },
    fab: {
        position: 'absolute',
        right: 20,
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        zIndex: 10, // Ensure FAB is on top
    }
});

export default BusinessDashboard;