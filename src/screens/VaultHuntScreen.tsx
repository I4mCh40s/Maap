// src/screens/VaultHuntScreen.tsx

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, SafeAreaView
} from 'react-native';
import { RouteProp, useRoute, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase';
import { Vault } from '../core/types';
import theme from '../theme';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { NativeModules } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { calculateDistance } from '../core/utils'; // Assuming this returns a string like "123 m away"

const { NFCModule } = NativeModules;

// (Navigation type definitions are unchanged)
type RootStackParamList = { VaultHunt: { vaultId: string }; Reward: { vault: Vault }; };
type VaultHuntRouteProp = RouteProp<RootStackParamList, 'VaultHunt'>;
type VaultHuntNavigationProp = NativeStackNavigationProp<RootStackParamList>;

// Proximity check radius in meters
const PROXIMITY_RADIUS_METERS = 50;

const VaultHuntScreen = () => {
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
      try {
        // 1. Fetch Vault Data
        const vaultDocRef = doc(db, 'vaults', vaultId);
        const docSnap = await getDoc(vaultDocRef);
        if (!docSnap.exists()) throw new Error('This vault no longer exists.');
        const fetchedVault = { id: docSnap.id, ...docSnap.data() } as Vault;
        setVault(fetchedVault);

        // 2. Get initial location & start watching
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('Location permission is required to hunt.');

        locationSubscription = await Location.watchPositionAsync(
            { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 2000, distanceInterval: 5 },
            (newLocation) => {
                const currentUserLocation = { lat: newLocation.coords.latitude, lng: newLocation.coords.longitude };
                setUserLocation(currentUserLocation);

                // Live update distance and proximity
                const distString = calculateDistance(currentUserLocation.lat, currentUserLocation.lng, fetchedVault.location.latitude, fetchedVault.location.longitude);
                setDistance(distString);
                
                // Raw distance calculation for proximity check
                const rawDistanceMeters = getRawDistance(currentUserLocation.lat, currentUserLocation.lng, fetchedVault.location.latitude, fetchedVault.location.longitude);
                setIsUserInProximity(rawDistanceMeters <= PROXIMITY_RADIUS_METERS);

                // Update user marker on map
                wv.current?.injectJavaScript(`updateUserMarker(${currentUserLocation.lat}, ${currentUserLocation.lng});`);
            }
        );

      } catch (e: any) {
        Alert.alert('Error Starting Hunt', e.message);
        navigation.goBack();
      } finally {
        setIsLoading(false);
      }
    };

    setupHunt();

    // Cleanup function
    return () => {
        locationSubscription?.remove();
    };
  }, [vaultId]);

  const mapHtml = useMemo(() => {
      if (!vault || !userLocation) return '';
      const TOMTOM_KEY = 'zoyiO1lknbi8bagOcFtqev5TcihUwvbR';

      return `
        <!DOCTYPE html><html><head>
          <style>html,body,#map{margin:0;padding:0;width:100%;height:100%;overflow:hidden;}</style>
          <script src="https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps-web.min.js"></script>
          <link href="https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps.css" rel="stylesheet"/>
        </head><body><div id="map"></div><script>
            const map = tt.map({ key: '${TOMTOM_KEY}', container: 'map', center: [${userLocation.lng}, ${userLocation.lat}], zoom: 16, style: "https://api.tomtom.com/style/2/custom/style/dG9tdG9tQEBAMzJSMkJDa1NmTGNvR2h3RzsO9cOMFdVDGI-DPwgg0BlM.json?key=${TOMTOM_KEY}" });
            
            const userMarkerEl = document.createElement('div');
            userMarkerEl.style.cssText = 'width:14px;height:14px;background:#007AFF;border:2px solid #FFF;border-radius:50%;';
            let userMarker = new tt.Marker({ element: userMarkerEl }).setLngLat([${userLocation.lng}, ${userLocation.lat}]).addTo(map);

            const vaultMarkerEl = document.createElement('div');
            vaultMarkerEl.style.cssText = 'width:28px;height:28px;background:#FFD700;border:2px solid #FFF;border-radius:50%;display:flex;justify-content:center;align-items:center;font-size:16px;font-weight:bold;color:#8B4513;';
            vaultMarkerEl.innerHTML = 'V';
            new tt.Marker({ element: vaultMarkerEl }).setLngLat([${vault.location.longitude}, ${vault.location.latitude}]).addTo(map);

            function updateUserMarker(lat, lng) {
                userMarker.setLngLat([lng, lat]);
                map.panTo([lng, lat]);
            }
        </script></body></html>`;
  }, [vault]); // Renders once when vault is loaded

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
            const vaultDocRef = doc(db, 'vaults', vault.id);
            await updateDoc(vaultDocRef, { claimedQuantity: increment(1) });
            // Use replace to prevent user from going back to this hunt screen
            navigation.replace('Reward', { vault });
        } else {
            Alert.alert("Wrong Vault", "This isn't the correct tag. Keep searching!");
        }
    } catch (e: any) { /* silent fail for user cancellation */
    } finally {
        setIsScanning(false);
    }
  };

  if (isLoading) {
    return <SafeAreaView style={styles.loadingContainer}><ActivityIndicator size="large" color={theme.colors.primary} /></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <MaterialCommunityIcons name="chevron-left" size={36} color={"white"} />
      </TouchableOpacity>

      <View style={styles.mapContainer}>
          {vault && userLocation && <WebView ref={wv} source={{ html: mapHtml }} style={{ flex: 1, borderRadius: 16 }}/>}
      </View>
      
      <View style={styles.detailsCard}>
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
                <Text style={styles.infoText}>{(vault?.totalQuantity || 0) - (vault?.claimedQuantity || 0)} Remaining</Text>
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
                  <MaterialCommunityIcons name="nfc-tap" size={24} color={isUserInProximity ? theme.colors.black : '#555'} />
                  <Text style={[styles.scanButtonText, !isUserInProximity && { color: '#555'}]}>
                      {isUserInProximity ? 'Scan to Unlock' : `Get Closer to Scan`}
                  </Text>
                </>
              )}
        </TouchableOpacity>
      </View>

    </SafeAreaView>
  );
};

// Styles have been updated to match your screenshot
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000', justifyContent: 'flex-end' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000000' },
  backButton: { position: 'absolute', top: 50, left: 10, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: 4, borderRadius: 25},
  mapContainer: {
    ...StyleSheet.absoluteFillObject, // Make map fill the background
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden'
  },
  detailsCard: {
      backgroundColor: '#1C1C1E',
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24
  },
  title: { fontSize: 28, fontWeight: 'bold', color: 'white'},
  subtitle: { fontSize: 16, color: 'grey', fontStyle: 'italic', marginTop: 4, marginBottom: 16},
  divider: { height: 1, backgroundColor: '#333', width: '100%', marginVertical: 8 },
  infoBox: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 16 },
  infoItem: { flexDirection: 'row', alignItems: 'center' },
  infoText: { color: 'white', fontSize: 16, marginLeft: 8 },
  scanButton: {
    backgroundColor: theme.colors.primary, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 18, borderRadius: 16, marginTop: 12
  },
  scanButtonDisabled: { backgroundColor: '#3e3e3e' },
  scanButtonText: { color: theme.colors.black, fontSize: 18, fontWeight: 'bold', marginLeft: 12 }
});

export default VaultHuntScreen;