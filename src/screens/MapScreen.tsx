// src/screens/MapScreen.tsx
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Alert, StyleSheet,
  ActivityIndicator, Platform, StatusBar, Modal, Image, AppState, AppStateStatus
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { collection, query, where, orderBy, startAt, endAt, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../firebase';
import theme from '../theme';
import { geohashQueryBounds } from 'geofire-common';
import { Vault, UserProfile } from '../core/types';
import { calculateDistance } from '../core/utils';

// Helper to debounce function calls. This prevents the vault fetch from firing too rapidly.
function debounce<F extends (...args: any[]) => any>(func: F, wait: number): (...args: Parameters<F>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return function(this: ThisParameterType<F>, ...args: Parameters<F>): void {
    const context = this;
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      timeout = null;
      func.apply(context, args);
    }, wait);
  };
}


export default function MapScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const wv = useRef<WebView>(null);
  const isScreenFocused = useIsFocused();
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  const [mapCenter, setMapCenter] = useState<{ lat: number, lng: number } | null>(null);
  const [userCoords, setUserCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [selectedVault, setSelectedVault] = useState<Vault | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [distance, setDistance] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // --- VAULT FETCHER WRAPPED IN useCallback AND debounce ---
  const fetchVaults = useCallback(
    debounce(async (coords: { lat: number, lng: number } | null) => {
      if (!coords) return;
      console.log("[MapScreen] Debounced: Fetching vaults near location...");
      try {
        const center = [coords.lat, coords.lng] as [number, number];
        const radiusInM = 10 * 1000;
        const bounds = geohashQueryBounds(center, radiusInM);
        const queryPromises = bounds.map(b => getDocs(query(collection(db, 'vaults'), orderBy('geohash'), startAt(b[0]), endAt(b[1]), where('isActive', '==', true))));
        const querySnapshots = await Promise.all(queryPromises);

        const newVaults: Map<string, Vault> = new Map();
        querySnapshots.forEach(snapshot => {
            snapshot.forEach(doc => {
                newVaults.set(doc.id, { id: doc.id, ...doc.data() } as Vault);
            });
        });

        setVaults(Array.from(newVaults.values()));
      } catch (error) {
          console.error("Error fetching vaults:", error);
      }
    }, 1500), // Debounce for 1.5 seconds to prevent spamming Firestore
    [] // Empty array means the debounced function is created only once
  );

  // --- EFFECT #1: LOCATION TRACKER ---
  useEffect(() => {
    // Only track location if the screen is focused.
    if (!isScreenFocused) return;

    let isMounted = true;
    const start = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert("Permission required", "Location access is needed.");
        return;
      }
      
      // If we don't have a map center yet, get it once.
      if (!mapCenter) {
          const initialLocation = await Location.getCurrentPositionAsync({});
          if (isMounted) {
            const pos = { lat: initialLocation.coords.latitude, lng: initialLocation.coords.longitude };
            setUserCoords(pos);
            setMapCenter(pos);
          }
      }
      
      locationSubscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 20 },
        (location) => {
            if (isMounted) {
                const pos = { lat: location.coords.latitude, lng: location.coords.longitude };
                setUserCoords(pos);
                wv.current?.injectJavaScript(`if(window.userMarker) window.userMarker.setLngLat([${pos.lng}, ${pos.lat}]); true;`);
            }
        }
      );
    };

    start();

    // Cleanup function.
    return () => {
      isMounted = false;
      if(locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
        console.log("[MapScreen] Stopped location tracking.");
      }
    };
  }, [isScreenFocused]);

  // --- EFFECT #2: TRIGGER VAULT FETCH ON LOCATION CHANGE ---
  useEffect(() => {
    // This will now be called safely, without causing a loop.
    fetchVaults(userCoords);
  }, [userCoords, fetchVaults]);

  // --- EFFECT #3: LISTEN FOR USER PROFILE ---
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setUserProfile(null); return; }
    const userDocRef = doc(db, 'users', uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) { setUserProfile(docSnap.data() as UserProfile); }
    });
    return () => unsubscribe();
  }, [auth.currentUser]);

  // --- EFFECT #4: REDRAW MAP MARKERS ---
  useEffect(() => {
    if (!ready || !vaults || !userProfile) return;
    const redeemedIds = userProfile.redeemedVaults || [];
    const dataToSend = { vaults, redeemedIds };
    wv.current?.injectJavaScript(`addMarkers(${JSON.stringify(dataToSend)}); true;`);
  }, [ready, vaults, userProfile]);

  const handleBeginHunt = () => {
    if (!selectedVault) return;
    navigation.navigate('VaultHunt', { vaultId: selectedVault.id });
    setSelectedVault(null);
  };

  const onWebMessage = (evt: any) => {
    try {
      const msg = JSON.parse(evt.nativeEvent.data);
      if (msg.type === 'vaultTap') {
        const tappedVault = vaults.find(v => v.id === msg.id);
        if (tappedVault && userCoords) {
          const dist = calculateDistance(userCoords.lat, userCoords.lng, tappedVault.location.latitude, tappedVault.location.longitude);
          setDistance(dist);
setSelectedVault(tappedVault);
        }
      } else if (msg.type === 'MAP_READY') {
        setReady(true);
      }
    } catch (e) {}
  };

  const locateMe = async () => {
    if (!userCoords) return;
    const { lat, lng } = userCoords;
    const js = `map.flyTo({ center: [${lng}, ${lat}], zoom: 15, essential: true });`;
    wv.current?.injectJavaScript(`${js} true;`);
  };

  const onSearch = async () => {
    if (!searchQuery.trim()) return;
    Alert.alert('Search Functionality', `Searching for: "${searchQuery.trim()}" (API not connected yet)`);
  };

  const redeemedIds = userProfile?.redeemedVaults || [];

  const mapHtml = useMemo(() => {
    if (!mapCenter) return '';
    const TOMTOM_KEY = 'zoyiO1lknbi8bagOcFtqev5TcihUwvbR';
    return `
      <!DOCTYPE html><html><head>
        <meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
        <script src="https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps-web.min.js"></script>
        <link href="https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps.css" rel="stylesheet"/>
        <style>
          html,body,#map{margin:0;padding:0;width:100%;height:100%}
          .user-marker {width:12px;height:12px;background:rgba(0,150,255,1);border:2px solid #FFF;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,.4);}
          .vault-marker { width: 28px; height: 28px; border: 2px solid #FFF; border-radius: 50%; cursor: pointer; display: flex; justify-content: center; align-items: center; font-size: 16px; font-weight: bold; box-shadow: 0 0 8px rgba(0,0,0,0.5); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; }
          .vault-marker.claimed { opacity: 0.5; filter: grayscale(80%); }
          .vault-marker-other { background: #FFD700; color: #8B4513; } .vault-marker-other::after { content: 'V'; }
          .vault-marker-cafe { background: #964B00; color: #FFF; } .vault-marker-cafe::after { content: '☕'; }
          .vault-marker-food { background: #DC143C; color: #FFF; } .vault-marker-food::after { content: '🍴'; }
          .vault-marker-retail { background: #4169E1; color: #FFF; } .vault-marker-retail::after { content: '🛍️'; }
        </style>
      </head><body>
        <div id="map"></div>
        <script>
          const postToApp = (msg) => window.ReactNativeWebView.postMessage(JSON.stringify(msg));
          const map = tt.map({ key: '${TOMTOM_KEY}', container: 'map', center: [${mapCenter.lng}, ${mapCenter.lat}], zoom: 14, style: "https://api.tomtom.com/style/2/custom/style/dG9tdG9tQEBAMzJSMkJDa1NmTGNvR2h3RzsO9cOMFdVDGI-DPwgg0BlM.json?key=${TOMTOM_KEY}" });
          window.userMarker = new tt.Marker({ element: document.createElement('div') }).setLngLat([${mapCenter.lng}, ${mapCenter.lat}]).addTo(map);
          window.userMarker.getElement().className = 'user-marker';
          
          let markers = [];
          function addMarkers(data) {
            const items = data.vaults;
            const claimedIds = data.redeemedIds;
            markers.forEach(m => m.remove()); markers = [];
            items.forEach(item => {
              const el = document.createElement('div');
              let className = 'vault-marker vault-marker-' + (item.category || 'other');
              if (claimedIds.includes(item.id)) { className += ' claimed'; }
              el.className = className;
              el.onclick = (event) => { event.stopPropagation(); postToApp({ type: 'vaultTap', id: item.id }); };
              const m = new tt.Marker({ element: el }).setLngLat([item.location.longitude, item.location.latitude]).addTo(map);
              markers.push(m);
            });
          }
          map.on('load', () => postToApp({ type: 'MAP_READY' }));
        </script>
      </body></html>`;
  }, [mapCenter, userProfile]);
  
  if (!mapCenter) {
    return <View style={styles.loading}><ActivityIndicator size="large" color={theme.colors.primary} /></View>;
  }

  const isClaimed = redeemedIds.includes(selectedVault?.id || '');
  
  return (
    <View style={styles.container}>
      <SafeAreaView style={{flex: 1}} edges={['top']}>
          <StatusBar barStyle="dark-content" />
          <WebView
              ref={wv}
              source={{ html: mapHtml }}
              onMessage={onWebMessage}
              onLoadEnd={() => setReady(true)}
              style={styles.webview}
          />
          <View style={[styles.searchBar, { top: insets.top + theme.spacing.sm }]}>
              <MaterialCommunityIcons name="magnify" size={22} color={theme.colors.lightGrey} style={{ marginRight: theme.spacing.sm }}/>
              <TextInput style={styles.searchInput} placeholder="Search location..." value={searchQuery} onChangeText={setSearchQuery} returnKeyType="search" onSubmitEditing={onSearch}/>
          </View>
          <TouchableOpacity style={styles.locateButton} onPress={locateMe}>
              <MaterialIcons name="my-location" size={24} color={theme.colors.lightGrey} />
          </TouchableOpacity>
      </SafeAreaView>

      <Modal animationType="fade" transparent={true} visible={!!selectedVault} onRequestClose={() => setSelectedVault(null)}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPressOut={() => setSelectedVault(null)}>
              <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
                  <View style={styles.cardContent}>
                      <View style={styles.cardHeader}>
                          {selectedVault?.businessLogoUrl ? <Image source={{ uri: selectedVault.businessLogoUrl }} style={styles.logoImage} /> : <View style={styles.logoPlaceholder}><MaterialCommunityIcons name="store-outline" size={24} color="#888" /></View>}
                          <Text style={styles.cardTitle}>{selectedVault?.businessName}</Text>
                      </View>
                      <View style={styles.cardSubHeader}><Text style={styles.cardSubtitle}>"{selectedVault?.publicName}"</Text></View>
                      <View style={styles.divider} />
                      <View style={styles.infoRow}>
                          <View style={styles.infoItem}><MaterialCommunityIcons name="gift-outline" size={20} color={'#8A8A8E'} /><Text style={styles.infoLabel}>{(selectedVault?.totalQuantity || 0) - (selectedVault?.claimedQuantity || 0)} Remaining</Text></View>
                          <View style={styles.infoItem}><MaterialCommunityIcons name="map-marker-distance" size={20} color={'#8A8A8E'} /><Text style={styles.infoLabel}>{distance}</Text></View>
                      </View>
                      <TouchableOpacity style={[styles.ctaButton, isClaimed && styles.ctaButtonDisabled]} onPress={handleBeginHunt} disabled={isClaimed}>
                          <Text style={styles.ctaButtonText}>{isClaimed ? "Already Claimed" : "Begin Hunt"}</Text>
                      </TouchableOpacity>
                  </View>
              </TouchableOpacity>
          </TouchableOpacity>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    webview: { flex: 1 },
    searchBar: { position: 'absolute', left: 15, right: 15, height: 50, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 15, backgroundColor: 'rgba(30, 30, 30, 0.9)', borderRadius: 25, borderWidth: 1, borderColor: '#555', zIndex: 10 },
    searchInput: { flex: 1, fontSize: 16, color: 'white' },
    locateButton: { position: 'absolute', right: 15, bottom: 100, width: 50, height: 50, borderRadius: 25, backgroundColor: 'rgba(30, 30, 30, 0.9)', borderWidth: 1, borderColor: '#555', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
    modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0, 0, 0, 0.4)' },
    modalCard: { width: '90%', maxWidth: 380, backgroundColor: 'white', borderRadius: 20, padding: 24, elevation: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 12 },
    cardContent: {},
    cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
    logoImage: { width: 44, height: 44, borderRadius: 8, marginRight: 12, backgroundColor: '#f0f0f0' },
    logoPlaceholder: { width: 44, height: 44, borderRadius: 8, marginRight: 12, backgroundColor: '#E5E5EA', justifyContent: 'center', alignItems: 'center' },
    cardTitle: { fontSize: 24, fontWeight: 'bold', color: '#1D1D1F', flex: 1 },
    cardSubHeader: { marginBottom: 20 },
    cardSubtitle: { fontSize: 16, color: '#6E6E73', fontStyle: 'italic' },
    divider: { height: 1, backgroundColor: '#E5E5EA', width: '100%', marginBottom: 20 },
    infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
    infoItem: { flexDirection: 'row', alignItems: 'center' },
    infoLabel: { fontSize: 16, color: '#3C3C43', marginLeft: 8 },
    ctaButton: { backgroundColor: theme.colors.primary, paddingVertical: 16, borderRadius: 12, alignItems: 'center' },
    ctaButtonDisabled: { backgroundColor: '#999' },
    ctaButtonText: { color: 'white', fontSize: 18, fontWeight: 'bold' },
});