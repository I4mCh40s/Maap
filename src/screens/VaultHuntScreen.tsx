// src/screens/VaultHuntScreen.tsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView, StatusBar
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, getDoc, updateDoc, increment, FieldValue, arrayUnion, setDoc } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Vault } from '../core/types';
import theme from '../theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeModules } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { calculateDistance } from '../core/utils'; // Assuming this returns a string like "123 m away"
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { NFCModule } = NativeModules;

// (Navigation type definitions are unchanged)
type RootStackParamList = { VaultHunt: { vaultId: string }; Reward: { vault: Vault }; };
type VaultHuntRouteProp = RouteProp<RootStackParamList, 'VaultHunt'>;
type VaultHuntNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Proximity check radius in meters
const PROXIMITY_RADIUS_METERS = 50;

const VaultHuntScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<VaultHuntNavigationProp>();
  const route = useRoute<VaultHuntRouteProp>();
  const { vaultId } = route.params;
  const wv = useRef<WebView>(null);

  const [vault, setVault] = useState<Vault | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [distance, setDistance] = useState<string | null>(null);
  const [isUserInProximity, setIsUserInProximity] = useState(false);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isScanning, setIsScanning] = useState(false);

  // Effect to fetch initial data and start watching location
  useEffect(() => {
    let locationSubscription: Location.LocationSubscription | null = null;
    const setupHunt = async () => {
        // We will fetch the vault FIRST.
        const vaultDocRef = doc(db, 'vaults', vaultId);
        const docSnap = await getDoc(vaultDocRef);
        if (!docSnap.exists()) throw new Error('Vault not found.');
        const fetchedVault = { id: docSnap.id, ...docSnap.data() } as Vault;
        setVault(fetchedVault);

        // We can set loading false here, the map will show a spinner until location is ready.
        setIsLoading(false);
        
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('Location permission is required.');
        
        // This subscription now handles ALL user location updates.
        locationSubscription = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 5 },
            (newLocation) => {
                const currentUserLocation = { lat: newLocation.coords.latitude, lng: newLocation.coords.longitude };
                // Set the user location ONCE for the initial map render, then only update state.
                setUserLocation(current => current ? current : currentUserLocation);

                const distString = calculateDistance(currentUserLocation.lat, currentUserLocation.lng, fetchedVault.location.latitude, fetchedVault.location.longitude);
                setDistance(distString);
                const rawDistanceMeters = getRawDistance(currentUserLocation.lat, currentUserLocation.lng, fetchedVault.location.latitude, fetchedVault.location.longitude);
                setIsUserInProximity(rawDistanceMeters <= PROXIMITY_RADIUS_METERS);
                wv.current?.injectJavaScript(`updateUserMarker(${currentUserLocation.lat}, ${currentUserLocation.lng});`);
            }
        );
    };
    setupHunt().catch(e => { Alert.alert('Error', e.message, [{ text: 'OK', onPress: () => navigation.goBack() }]) });
    return () => { locationSubscription?.remove(); };
}, [vaultId]);

const mapHtml = useMemo(() => {
    // THIS is now the single point of truth. HTML is only generated when BOTH are ready.
    if (!vault || !userLocation) {
        return `<html><body style="background-color: #333;"></body></html>`; // Return blank HTML
    }
    const TOMTOM_KEY = 'zoyiO1lknbi8bagOcFtqev5TcihUwvbR';
      return `
        <!DOCTYPE html><html><head>
          <style>html,body,#map{margin:0;padding:0;width:100%;height:100%;overflow:hidden; background-color: #333;}</style>
          <script src="https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps-web.min.js"></script>
          <link href="https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps.css" rel="stylesheet"/>
        </head><body><div id="map"></div><script>
            const map = tt.map({ key: '${TOMTOM_KEY}', container: 'map', center: [${userLocation.lng}, ${userLocation.lat}], zoom: 15, style: "https://api.tomtom.com/style/2/custom/style/dG9tdG9tQEBAMzJSMkJDa1NmTGNvR2h3RzsO9cOMFdVDGI-DPwgg0BlM.json?key=${TOMTOM_KEY}" });
            
            const userMarkerEl = document.createElement('div');
            userMarkerEl.style.cssText = 'width:14px;height:14px;background:#007AFF;border:2px solid #FFF;border-radius:50%;box-shadow: 0 0 5px #000;';
            let userMarker = new tt.Marker({ element: userMarkerEl }).setLngLat([${userLocation.lng}, ${userLocation.lat}]).addTo(map);

            const vaultMarkerEl = document.createElement('div');
            vaultMarkerEl.style.cssText = 'width:28px;height:28px;background:#FFD700;border:2px solid #FFF;border-radius:50%;display:flex;justify-content:center;align-items:center;font-size:16px;font-weight:bold;color:#8B4513;box-shadow: 0 0 8px rgba(0,0,0,0.5);';
            vaultMarkerEl.innerHTML = 'V';
            new tt.Marker({ element: vaultMarkerEl }).setLngLat([${vault.location.longitude}, ${vault.location.latitude}]).addTo(map);

            // Zoom the map to fit both markers
            const bounds = new tt.LngLatBounds();
            bounds.extend([${userLocation.lng}, ${userLocation.lat}]);
            bounds.extend([${vault.location.longitude}, ${vault.location.latitude}]);
            map.fitBounds(bounds, { padding: 80, duration: 500 });

            function updateUserMarker(lat, lng) {
                userMarker.setLngLat([lng, lat]);
                map.panTo([lng, lat], { duration: 1000 });
            }
        </script></body></html>`;
  // --- FIX: Add userLocation to the dependency array ---
  }, [vault, userLocation]); 
  
  // Raw distance helper
  const getRawDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // metres
    const φ1 = lat1 * Math.PI/180;
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // in metres
  }
  
  const handleScan = async () => {
    if (!vault) return;
    setIsScanning(true);
    Alert.alert("Ready to Scan", "Hold your phone near the Vault's NFC tag.");
    try {
        const scannedTagId: string = await NFCModule.scanTag();
        if (scannedTagId === vault.nfcTagId) {
            // SUCCESS!

            const uid = auth.currentUser!.uid; // Get the current user's ID
            if (!uid) throw new Error("User not found.");

            // 1. Get references to both documents we need to update
            const vaultDocRef = doc(db, 'vaults', vault.id);
            const userDocRef = doc(db, 'users', uid);

            // --- THIS IS THE NEW LOGIC ---
            // 2. Perform both database updates
            await updateDoc(vaultDocRef, { claimedQuantity: increment(1) });
            await setDoc(userDocRef, {
                redeemedVaults: arrayUnion(vault.id)
            }, { merge: true });
            // --- END NEW LOGIC ---

            navigation.replace('Reward', { vault });
        } else {
            Alert.alert("Wrong Vault", "This isn't the correct tag. Keep searching!");
        }
    } catch (e: any) {
        console.log("Scan or DB Update Error:", e.message);
    } finally {
        setIsScanning(false);
    }
  };

  if (isLoading) {
    return <SafeAreaView style={styles.loadingContainer}><ActivityIndicator size="large" color={theme.colors.primary} /></SafeAreaView>;
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* MAP CONTAINER - Takes a flex proportion of the screen */}
      <View style={styles.mapContainer}>
          {mapHtml && <WebView key={mapHtml} source={{ html: mapHtml }} style={{ flex: 1 }}/>}
      </View>
      
      {/* DETAILS CARD - Takes its own space at the bottom */}
      <View style={[styles.detailsCard, { paddingBottom: insets.bottom + 12 }]}>
        <Text style={styles.title}>{vault?.businessName}</Text>
        <Text style={styles.subtitle}>"{vault?.publicName}"</Text>
        <View style={styles.divider} />
        
        <View style={styles.infoBox}>
            <View style={styles.infoItem}>
                <MaterialCommunityIcons name="map-marker-distance" size={24} color={'#8A8A8E'}/>
                <Text style={styles.infoText}>{distance ?? 'Calculating...'}</Text>
            </View>
            <View style={styles.infoItem}>
                <MaterialCommunityIcons name="gift-outline" size={24} color={'#8A8A8E'}/>
                <Text style={styles.infoText}>{((vault?.totalQuantity ?? 0) - (vault?.claimedQuantity ?? 0))} Remaining</Text>
            </View>
        </View>

        <TouchableOpacity 
            style={[styles.scanButton, (isScanning || !isUserInProximity) && styles.scanButtonDisabled]} 
            onPress={handleScan} 
            disabled={isScanning || !isUserInProximity}>
              {isScanning ? (
                  <ActivityIndicator color={theme.colors.black} /> 
              ) : (
                <>
                  <MaterialCommunityIcons name="nfc-tap" size={24} color={isUserInProximity ? theme.colors.black : '#888'} />
                  <Text style={[styles.scanButtonText, !isUserInProximity && { color: '#888'}]}>
                      {isUserInProximity ? 'Scan to Unlock' : `Get Closer to Scan`}
                  </Text>
                </>
              )}
        </TouchableOpacity>
      </View>
      
      {/* BACK BUTTON - Floats on top */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { top: insets.top + 10 }]}>
        <MaterialCommunityIcons name="chevron-left" size={36} color={"white"} />
      </TouchableOpacity>
    </View>
  );
};

// Styles have been updated to match your screenshot
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#1C1C1E', // Match card color for seamless look
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#000000' 
  },
  backButton: { 
    position: 'absolute', 
    left: 15, 
    zIndex: 10, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    padding: 4, 
    borderRadius: 25
  },
  mapContainer: {
    flex: 0.6, // Gives the map ~60% of the screen height
    backgroundColor: '#333', // Placeholder background
  },
  detailsCard: {
      flex: 0.4, // Gives the card ~40% of the screen height
      backgroundColor: '#1C1C1E',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      paddingHorizontal: 24,
      paddingTop: 24
  },
  title: { fontSize: 28, fontWeight: 'bold', color: 'white'},
  subtitle: { fontSize: 16, color: 'grey', fontStyle: 'italic', marginTop: 4, marginBottom: 16},
  divider: { height: 1, backgroundColor: '#333', width: '100%', marginVertical: 8 },
  infoBox: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16 },
  infoItem: { flexDirection: 'row', alignItems: 'center' },
  infoText: { color: 'white', fontSize: 16, marginLeft: 8 },
  scanButton: {
    backgroundColor: theme.colors.primary, 
    flexDirection: 'row',
    alignItems: 'center', 
    justifyContent: 'center',
    paddingVertical: 18, 
    borderRadius: 16, 
    marginTop: 12, // Use marginTop to push down from infoBox
  },
  scanButtonDisabled: { backgroundColor: '#3e3e3e' },
  scanButtonText: { color: theme.colors.black, fontSize: 18, fontWeight: 'bold', marginLeft: 12 }
});

export default VaultHuntScreen;