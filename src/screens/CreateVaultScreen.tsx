// src/screens/CreateVaultScreen.tsx
import React, { useState } from 'react';
import { 
    View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { collection, addDoc, doc, getDoc, GeoPoint } from 'firebase/firestore';
import { db, auth } from '../firebase';
import theme from '../theme';
import { NativeModules } from 'react-native';
import { BusinessProfile } from '../core/types';
import { geohashForLocation } from 'geofire-common';

// Just import the NativeModules object
const { NFCModule } = NativeModules;

const CreateVaultScreen = () => {
    const navigation = useNavigation();
    const [publicName, setPublicName] = useState('');
    const [privateReward, setPrivateReward] = useState('');
    const [redemptionCode, setRedemptionCode] = useState('');
    const [totalQuantity, setTotalQuantity] = useState('100');
    const [nfcTagId, setNfcTagId] = useState<string | null>(null);
    const [isLinking, setIsLinking] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // This is the clean, Promise-based handler. No listeners needed.
    const handleLinkTag = async () => {
        setIsLinking(true);
        Alert.alert("Ready to Scan", "Hold your phone near a new, unlinked NFC tag.");
        try {
            // Await the result directly from our upgraded native module
            const scannedId: string = await NFCModule.scanTag();
            setNfcTagId(scannedId);
            Alert.alert("Success!", `Tag linked: ${scannedId}`);
        } catch (error: any) {
            // The promise will reject if scanning fails or is cancelled
            console.log("NFC Scan error:", error.message);
            // We only show an alert for actual errors, not user cancellation
            if (error.code !== "USER_CANCELLED") { // Assuming you might add this code in native
                Alert.alert("Scan Failed", error.message || "Could not read the NFC tag. Please try again.");
            }
        } finally {
            setIsLinking(false);
        }
    };
    
    // This function is correct and doesn't need to change.
    const handleCreateVault = async () => {
        if (!publicName || !privateReward || !redemptionCode || !totalQuantity || !nfcTagId) {
            Alert.alert("Incomplete Form", "Please fill out all fields and link an NFC tag.");
            return;
        }

        setIsCreating(true);
        try {
            const uid = auth.currentUser!.uid;
            const userDoc = await getDoc(doc(db, 'users', uid));
            const businessId = userDoc.data()?.businessId;
            
            if (!businessId) throw new Error("Could not find your business profile.");

            const businessDoc = await getDoc(doc(db, 'businesses', businessId));
            const businessProfile = businessDoc.data() as BusinessProfile;
            
            if (!businessProfile.latitude || !businessProfile.longitude) {
              Alert.alert("Missing Location", "Your business profile needs a location set before creating a vault.");
              setIsCreating(false);
              return;
            }

            const geohash = geohashForLocation([businessProfile.latitude, businessProfile.longitude]);

            await addDoc(collection(db, 'vaults'), {
                businessId: businessId,
                businessName: businessProfile.name,
                publicName,
                privateReward,
                redemptionCode,
                totalQuantity: parseInt(totalQuantity, 10),
                nfcTagId,
                location: new GeoPoint(businessProfile.latitude, businessProfile.longitude),
                geohash: geohash,
                claimedQuantity: 0,
                isActive: true,
            });

            Alert.alert("Success!", "Your new vault is live on the map.");
            navigation.goBack();

        } catch (error: any) {
            console.error("Error creating vault: ", error);
            Alert.alert("Creation Failed", error.message || "An unexpected error occurred.");
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
            <Text style={styles.title}>Create New Vault</Text>

            <Text style={styles.label}>Public Name (Teaser)</Text>
            <TextInput 
                style={styles.input}
                placeholder="e.g., A Refreshing Surprise"
                value={publicName}
                onChangeText={setPublicName}
                placeholderTextColor="#555"
            />

            <Text style={styles.label}>Private Reward (The Prize)</Text>
            <TextInput
                style={styles.input}
                placeholder="e.g., One Free Iced Tea"
                value={privateReward}
                onChangeText={setPrivateReward}
                placeholderTextColor="#555"
            />

            <Text style={styles.label}>Redemption Code</Text>
            <TextInput
                style={styles.input}
                placeholder="Code for your cashier (e.g., ICETEA24)"
                value={redemptionCode}
                onChangeText={setRedemptionCode}
                placeholderTextColor="#555"
            />

            <Text style={styles.label}>Total Quantity</Text>
            <TextInput
                style={styles.input}
                placeholder="e.g., 100"
                value={totalQuantity}
                onChangeText={setTotalQuantity}
                keyboardType="number-pad"
                placeholderTextColor="#555"
            />
            
            <View style={styles.nfcContainer}>
                <TouchableOpacity 
                    style={[styles.button, styles.nfcButton, isLinking && styles.buttonDisabled]} 
                    onPress={handleLinkTag} 
                    disabled={isLinking}>
                        {isLinking ? <ActivityIndicator color="white"/> : 
                        <Text style={styles.buttonText}>Link NFC Tag</Text>}
                </TouchableOpacity>
                <Text style={styles.nfcStatus}>
                    {nfcTagId ? `Linked: ${nfcTagId}` : 'No Tag Linked'}
                </Text>
            </View>

            <TouchableOpacity 
                style={[styles.button, styles.createButton, isCreating && styles.buttonDisabled]} 
                onPress={handleCreateVault}
                disabled={isCreating}>
                {isCreating ? <ActivityIndicator color="white"/> :
                <Text style={styles.buttonText}>Activate Vault</Text>}
            </TouchableOpacity>

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: '#121212'},
    title: { fontSize: 32, fontWeight: 'bold', color: 'white', marginBottom: 30, paddingTop: 40, },
    label: { fontSize: 16, color: 'grey', marginBottom: 8 },
    input: {
        backgroundColor: '#1c1c1e',
        color: 'white',
        padding: 15,
        borderRadius: 10,
        fontSize: 16,
        marginBottom: 20,
    },
    button: {
        width: '100%',
        padding: 15,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 10,
    },
    buttonDisabled: {
        backgroundColor: '#555',
    },
    nfcButton: {
        backgroundColor: '#3a3a3c',
    },
    createButton: {
        backgroundColor: theme.colors.primary,
        marginTop: 30,
        marginBottom: 50, // Add space at the bottom
    },
    buttonText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 16,
    },
    nfcContainer: {
        marginTop: 20,
        borderTopWidth: 1,
        borderTopColor: '#333',
        paddingTop: 20,
    },
    nfcStatus: {
        color: 'grey',
        textAlign: 'center',
        marginTop: 15,
    }
});

export default CreateVaultScreen;