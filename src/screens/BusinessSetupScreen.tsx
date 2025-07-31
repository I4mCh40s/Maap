import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, Image
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { doc, setDoc, updateDoc, getDoc, GeoPoint, collection } from 'firebase/firestore';
import { db, auth, storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import * as ImagePicker from 'expo-image-picker';
import theme from '../theme';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { geohashForLocation } from 'geofire-common';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BusinessProfile } from '../core/types';

type RootStackParamList = { BusinessSetup: { isEditing?: boolean, businessId?: string }; };
type BusinessSetupRouteProp = RouteProp<RootStackParamList, 'BusinessSetup'>;
type BusinessSetupNavigationProp = { navigate: (screen: string, params?: any) => void; goBack: () => void; };

const BusinessSetupScreen = () => {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<BusinessSetupNavigationProp>();
    const route = useRoute<BusinessSetupRouteProp>();

    const [businessName, setBusinessName] = useState('');
    const [category, setCategory] = useState('');
    const [location, setLocation] = useState<{ lat: number, lng: number } | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const wv = useRef<WebView>(null);
    const [initialCenter, setInitialCenter] = useState<{lat: number, lng: number} | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [logoUri, setLogoUri] = useState<string | null>(null);
    const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null);

    useEffect(() => {
        if (route.params?.isEditing && route.params?.businessId) {
            setIsEditing(true);
            setIsLoading(true);
            const fetchBusinessData = async () => {
                try {
                    const businessDocRef = doc(db, 'businesses', route.params.businessId!);
                    const docSnap = await getDoc(businessDocRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data() as BusinessProfile;
                        setBusinessName(data.name);
                        setCategory(data.category);
                        if (data.location) {
                            const loc = { lat: data.location.latitude, lng: data.location.longitude };
                            setLocation(loc);
                            setInitialCenter(loc);
                        }
                        if (data.logoUrl) {
                            setExistingLogoUrl(data.logoUrl);
                        }
                    } else {
                        throw new Error("Business profile could not be found.");
                    }
                } catch (error: any) {
                    Alert.alert('Error Loading Profile', error.message || 'An unknown error occurred.', [{ text: 'OK', onPress: () => navigation.goBack() }]);
                } finally {
                    setIsLoading(false);
                }
            };
            fetchBusinessData();
        } else {
            (async () => {
                let { status } = await Location.requestForegroundPermissionsAsync();
                if (status !== 'granted') { setInitialCenter({ lat: 34.0522, lng: -118.2437 }); return; }
                let loc = await Location.getCurrentPositionAsync({});
                setInitialCenter({ lat: loc.coords.latitude, lng: loc.coords.longitude });
            })();
        }
    }, [route.params]);
    
    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Sorry, we need camera roll permissions!'); return; }
        let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.5 });
        if (!result.canceled) { setLogoUri(result.assets[0].uri); }
    };
    
    const handleMapMessage = (event: any) => { const data = JSON.parse(event.nativeEvent.data); if (data.type === 'mapTap') { setLocation({ lat: data.lat, lng: data.lng }); wv.current?.injectJavaScript(`moveMarker(${data.lat}, ${data.lng});`); } };
    const mapHtml = useMemo(() => { if (!initialCenter) return ''; const TOMTOM_KEY = 'zoyiO1lknbi8bagOcFtqev5TcihUwvbR'; const markerPosition = location ? `[${location.lng}, ${location.lat}]` : `[${initialCenter.lng}, ${initialCenter.lat}]`; return `<!DOCTYPE html>...`; }, [initialCenter, location]); // Full HTML omitted for brevity
    
    const handleSaveProfile = async () => {
        if (!businessName.trim() || !category || !location) { Alert.alert('Incomplete', 'Please fill all fields and set a location.'); return; }
        setIsLoading(true);
        try {
            const uid = auth.currentUser!.uid;
            let finalLogoUrl = existingLogoUrl;
            if (logoUri) {
                const response = await fetch(logoUri);
                const blob = await response.blob();
                const storageRef = ref(storage, `business-logos/${uid}-${Date.now()}.jpg`);
                await uploadBytes(storageRef, blob);
                finalLogoUrl = await getDownloadURL(storageRef);
            }

            const geohash = geohashForLocation([location.lat, location.lng]);
            const profileData = { name: businessName, category: category, location: new GeoPoint(location.lat, location.lng), latitude: location.lat, longitude: location.lng, geohash: geohash, logoUrl: finalLogoUrl };
            if (isEditing) {
                await updateDoc(doc(db, 'businesses', route.params.businessId!), profileData);
                Alert.alert('Success', 'Profile updated!'); navigation.goBack();
            } else {
                const businessDocRef = doc(collection(db, 'businesses'));
                await setDoc(businessDocRef, { ...profileData, ownerUid: uid });
                await updateDoc(doc(db, 'users', uid), { isBusiness: true, businessId: businessDocRef.id });
                Alert.alert('Success', 'Your business is registered!'); navigation.navigate('BusinessDashboard', { businessId: businessDocRef.id });
            }
        } catch (error: any) { console.error("Save failed:", error); Alert.alert('Error', 'Failed to save profile.');
        } finally { setIsLoading(false); }
    };

    if (!initialCenter || (isEditing && isLoading && !businessName)) { return <View style={[styles.container, {justifyContent: 'center'}]}><ActivityIndicator size="large" color={theme.colors.primary}/></View>; }
    
    return (
        <View style={styles.container}>
            <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={{ paddingTop: insets.top + 70, paddingBottom: insets.bottom + 20 }} keyboardShouldPersistTaps="handled">
                    <View style={styles.logoPickerContainer}>
                        <TouchableOpacity onPress={handlePickImage}>
                            <Image source={logoUri ? { uri: logoUri } : (existingLogoUrl ? { uri: existingLogoUrl } : require('../../assets/placeholder.png'))} style={styles.logoImage} />
                            <View style={styles.logoEditIcon}><MaterialCommunityIcons name="pencil-outline" size={18} color="white" /></View>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>Business Name</Text>
                    <TextInput style={styles.input} value={businessName} onChangeText={setBusinessName} placeholder="e.g., The Daily Grind" placeholderTextColor="#555"/>

                    <Text style={styles.label}>Category</Text>
                    <View style={styles.categoryContainer}>
                        {['cafe', 'retail', 'food', 'other'].map(cat => ( <TouchableOpacity key={cat} style={[styles.categoryButton, category === cat && styles.categoryButtonActive]} onPress={() => setCategory(cat)}> <Text style={[styles.categoryText, category === cat && styles.categoryTextActive]}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</Text> </TouchableOpacity> ))}
                    </View>

                    <Text style={styles.label}>Set Your Location</Text>
                    <Text style={styles.subLabel}>Tap map to place your pin.</Text>
                    <View style={styles.mapContainer}>
                        <WebView ref={wv} source={{ html: mapHtml || '' }} onMessage={handleMapMessage} style={styles.webview} />
                        {location && <MaterialCommunityIcons name="check-circle" size={32} color={theme.colors.success} style={styles.checkIcon}/>}
                    </View>
                    
                    <TouchableOpacity style={[styles.saveButton, isLoading && styles.saveButtonDisabled]} onPress={handleSaveProfile} disabled={isLoading}>
                        {isLoading ? <ActivityIndicator color={isEditing ? 'white' : 'black'}/> : <Text style={styles.saveButtonText}>Save Profile</Text>}
                    </TouchableOpacity>

                </ScrollView>
            </KeyboardAvoidingView>
            <View style={[styles.header, { paddingTop: insets.top, height: insets.top + 60 }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><MaterialCommunityIcons name="chevron-left" size={32} color="white" /></TouchableOpacity>
                <Text style={styles.title}>{isEditing ? "Edit Profile" : "Register Your Business"}</Text>
                <View style={{ width: 42 }} />
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#121212',
    },
    header: {
        position: 'absolute', top: 0, left: 0, right: 0,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 10, backgroundColor: '#1C1C1E',
        zIndex: 10, borderBottomWidth: 1, borderBottomColor: '#333'
    },
    backButton: { padding: 5 },
    title: { fontSize: 20, fontWeight: 'bold', color: 'white' },
    label: { fontSize: 16, color: 'grey', marginBottom: 8, marginLeft: 20 },
    subLabel: { fontSize: 14, color: '#555', marginBottom: 8, marginLeft: 20 },
    input: {
        backgroundColor: '#1c1c1e', color: 'white', padding: 15, borderRadius: 10,
        fontSize: 16, marginBottom: 24, marginHorizontal: 20
    },
    categoryContainer: {
        flexDirection: 'row', justifyContent: 'space-around',
        marginBottom: 24, marginHorizontal: 20, flexWrap: 'wrap',
    },
    categoryButton: {
        borderWidth: 1, borderColor: '#333',
        paddingVertical: 10, paddingHorizontal: 15, borderRadius: 20, margin: 4,
    },
    categoryButtonActive: {
        backgroundColor: theme.colors.primary,
        borderColor: theme.colors.primary
    },
    categoryText: { color: 'white' },
    categoryTextActive: { color: theme.colors.black, fontWeight: 'bold' },
    mapContainer: {
        height: 250, borderRadius: 10, overflow: 'hidden',
        marginHorizontal: 20, marginBottom: 24, borderWidth: 1, borderColor: '#333'
    },
    webview: { flex: 1 },
    checkIcon: { position: 'absolute', top: 10, right: 10 },
    saveButton: {
        backgroundColor: theme.colors.primary, padding: 20, borderRadius: 10,
        alignItems: 'center', marginHorizontal: 20, marginBottom: 20,
    },
    saveButtonDisabled: { backgroundColor: '#555' },
    saveButtonText: { color: theme.colors.black, fontWeight: '700', fontSize: 18 },
    logoPickerContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    logoImage: {
        width: 120,
        height: 120,
        borderRadius: 60, // Make it a circle
        borderWidth: 3,
        borderColor: theme.colors.primary,
        backgroundColor: '#333'
    },
    logoEditIcon: {
        position: 'absolute',
        bottom: 5,
        right: 5,
        backgroundColor: 'rgba(0,0,0,0.7)',
        padding: 6,
        borderRadius: 15,
    },
});

export default BusinessSetupScreen;