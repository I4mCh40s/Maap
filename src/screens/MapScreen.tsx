// src/screens/MapScreen.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Platform,
  StatusBar,
  Modal,
  Image,
  AppState,
  AppStateStatus,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { doc, collection, onSnapshot, query, where, orderBy, startAt, endAt, Unsubscribe } from 'firebase/firestore';
import { db, auth } from '../firebase';
import WebMapView from '../components/WebMapView';
import theme from '../theme';
import { geohashQueryBounds } from 'geofire-common';
import { Vault, UserProfile } from '../core/types';
import { calculateDistance } from '../core/utils';
import { useIsFocused } from '@react-navigation/native'; 



export default function MapScreen({ route, navigation }: any) {
  // --- CORE HOOKS ---
  const insets = useSafeAreaInsets();
  const wv = useRef<WebView>(null);

  // --- STATE MANAGEMENT ---
  const [ready, setReady] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number, lng: number } | null>(null);
  const [mapCenter, setMapCenter] = useState<{ lat: number, lng: number } | null>(null);
  const [vaults, setVaults] = useState<Vault[]>([]);
  const [selectedVault, setSelectedVault] = useState<Vault | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [jsToInject, setJsToInject] = useState<{ code: string; timestamp: number } | undefined>();
  const [distance, setDistance] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const isClaimed = userProfile?.redeemedVaults?.includes(selectedVault?.id || '');
  const isScreenFocused = useIsFocused();
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // --- EFFECT HOOKS ---

   
  // Handles "fly-to" requests
  useEffect(() => {
    if (route.params?.flyToCoords) {
      const { lat, lng } = route.params.flyToCoords;
      const js = `map.flyTo({ center: [${lng}, ${lat}], zoom: 17, essential: true });`;
      wv.current?.injectJavaScript(`${js} true;`);
      navigation.setParams({ flyToCoords: undefined });
    }
  }, [route.params?.flyToCoords]);

  // Handles re-centering on focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (route.params?.shouldRecenter) {
        locateMe();
        navigation.setParams({ shouldRecenter: undefined });
      }
    });
    return unsubscribe;
  }, [navigation, route.params]);

// --- EFFECT: Listen for User Profile ---
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setUserProfile(null); return; }
    const userDocRef = doc(db, 'users', uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) { setUserProfile(docSnap.data() as UserProfile); }
    });
    return () => unsubscribe();
  }, [auth.currentUser]);

  // --- EFFECT: Listen for Vaults based on User Location ---
  useEffect(() => {
    if (!userCoords) return;
    const center = [userCoords.lat, userCoords.lng] as [number, number];
    const radiusInM = 10 * 1000;
    const bounds = geohashQueryBounds(center, radiusInM);
    const unsubscribes = bounds.map(b => {
      const q = query(collection(db, 'vaults'), orderBy('geohash'), startAt(b[0]), endAt(b[1]), where('isActive', '==', true));
      return onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
          const vaultData = { id: change.doc.id, ...change.doc.data() } as Vault;
          if (change.type === 'removed') {
            setVaults(prevVaults => prevVaults.filter(v => v.id !== vaultData.id));
          } else {
            setVaults(prevVaults => {
              const vaultMap = new Map(prevVaults.map(v => [v.id, v]));
              vaultMap.set(vaultData.id, vaultData);
              return Array.from(vaultMap.values());
            });
          }
        });
      });
    });
    return () => { unsubscribes.forEach(unsub => unsub()); };
  }, [userCoords]);

  // --- EFFECT: Manage Live Location Tracking ---
  useEffect(() => {
    const startLocationTracking = async () => {
      if (locationSubscription.current) return;
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;

      if (!userCoords) {
          const initialLocation = await Location.getCurrentPositionAsync({});
          const initialCoords = { lat: initialLocation.coords.latitude, lng: initialLocation.coords.longitude };
          setUserCoords(initialCoords);
          if (!mapCenter) setMapCenter(initialCoords);
      }

      locationSubscription.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 3000, distanceInterval: 10 },
        (location) => {
          const pos = { lat: location.coords.latitude, lng: location.coords.longitude };
          setUserCoords(pos);
          wv.current?.injectJavaScript(`if(window.userMarker) window.userMarker.setLngLat([${pos.lng}, ${pos.lat}]); true;`);
        }
      );
    };

    const stopLocationTracking = () => {
      if (locationSubscription.current) {
        locationSubscription.current.remove();
        locationSubscription.current = null;
      }
    };
    
    if (isScreenFocused) {
      startLocationTracking();
    } else {
      stopLocationTracking();
    }

    return () => stopLocationTracking();
  }, [isScreenFocused]);

  // Redraws markers on map (depends on userProfile to get claimed status right)
  useEffect(() => {
    if (!ready || !vaults || !userProfile) return;
    const markerArray = JSON.stringify(vaults);
    wv.current?.injectJavaScript(`addMarkers(${markerArray}); true;`);
  }, [ready, vaults, userProfile]);

  
  // --- HANDLER FUNCTIONS ---

  function handleBeginHunt() {
  if (!selectedVault) return;
  // Navigate first, then close the modal.
  navigation.navigate('VaultHunt', { vaultId: selectedVault.id });
  setSelectedVault(null);
}

function onWebMessage(evt: any) {
  try {
    const msg = JSON.parse(evt.nativeEvent.data);
    if (msg.type === 'vaultTap') {
      const tappedVault = vaults.find(v => v.id === msg.id);
      if (tappedVault && userCoords) { // <-- Make sure we have user coords
        // --- NEW DISTANCE CALCULATION ---
        const dist = calculateDistance(
          userCoords.lat,
          userCoords.lng,
          tappedVault.location.latitude,
          tappedVault.location.longitude
        );
        setDistance(dist);
        setSelectedVault(tappedVault);
      }
    } else if (msg.type === 'MAP_READY') {
      setReady(true);
    }
  } catch (e) { /* ignore */ }
}

  async function locateMe() {
    if (!userCoords) return;
    const { lat, lng } = userCoords;
    const js = `map.flyTo({ center: [${lng}, ${lat}], zoom: 15, essential: true });`;
    wv.current?.injectJavaScript(`${js} true;`);
  }

  async function onSearch() {
    if (!searchQuery.trim()) return;
    
    // In the future, you can integrate with TomTom's Search API here.
    // For now, a simple alert will do.
    Alert.alert(
      'Search Functionality',
      `Searching for: "${searchQuery.trim()}" (API not connected yet)`
    );

    // This is where you would make the API call like:
    /*
    try {
      const res = await fetch(`https://api.tomtom.com/search/2/geocode/${encodeURIComponent(searchQuery)}.json?key=YOUR_TOMTOM_API_KEY`);
      const json = await res.json();
      const pos = json.results?.[0]?.position;
      if (pos) {
        setMapCenter({ lat: pos.lat, lng: pos.lon });
      } else { Alert.alert('Not found', 'Could not locate that address.'); }
    } catch (e: any) { Alert.alert('Search failed', e.message); }
    */
}
  // Get the list of redeemed vault IDs
  const redeemedIds = userProfile?.redeemedVaults || [];

  // --- WebView HTML ---

  const mapHtml = useMemo(() => {
    if (!mapCenter) return '';
    const TOMTOM_KEY = 'zoyiO1lknbi8bagOcFtqev5TcihUwvbR';
    return `
      <!DOCTYPE html><html><head>
        <meta charset="utf-g"/><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
        <script src="https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps-web.min.js"></script>
        <link href="https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps.css" rel="stylesheet"/>
        <style>
          html,body,#map{margin:0;padding:0;width:100%;height:100%}
          .user-marker {width:12px;height:12px;background:rgba(0,150,255,1);border:2px solid #FFF;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,.4);}
          
          /* --- BASE STYLE FOR ALL VAULTS --- */
          .vault-marker {
            width: 28px; height: 28px; 
            border: 2px solid #FFF;
            border-radius: 50%;
            cursor: pointer;
            display: flex; justify-content: center; align-items: center;
            font-size: 16px; font-weight: bold;
            box-shadow: 0 0 8px rgba(0,0,0,0.5);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; /* Use system font for icons */
          }
          .vault-marker.claimed {
              opacity: 0.5;
              filter: grayscale(100%);
          }

          /* --- CATEGORY-SPECIFIC STYLES --- */
          /* Default/Other */
          .vault-marker-other { background: #FFD700; color: #8B4513; }
          .vault-marker-other::after { content: 'V'; } /* V for Vault */
          
          /* Cafe */
          .vault-marker-cafe { background: #964B00; color: #FFF; }
          .vault-marker-cafe::after { content: '☕'; } /* Coffee icon */

          /* Food */
          .vault-marker-food { background: #DC143C; color: #FFF; }
          .vault-marker-food::after { content: '🍴'; } /* Fork & Knife icon */
          
          /* Retail */
          .vault-marker-retail { background: #4169E1; color: #FFF; }
          .vault-marker-retail::after { content: '🛍️'; } /* Shopping bag icon */
          
        </style>
      </head><body>
        <div id="map"></div>
        <script>
          const postToApp = (msg) => window.ReactNativeWebView?.postMessage(JSON.stringify(msg));
          const map = tt.map({ key: '${TOMTOM_KEY}', container: 'map', center: [${mapCenter.lng}, ${mapCenter.lat}], zoom: 14, style: "https://api.tomtom.com/style/2/custom/style/dG9tdG9tQEBAMzJSMkJDa1NmTGNvR2h3RzsO9cOMFdVDGI-DPwgg0BlM.json?key=${TOMTOM_KEY}" });
          window.userMarker = new tt.Marker({ element: document.createElement('div') }).setLngLat([${mapCenter.lng}, ${mapCenter.lat}]).addTo(map);
          window.userMarker.getElement().className = 'user-marker';
          const claimedIds = ${JSON.stringify(redeemedIds)};
          let markers = [];
          function addMarkers(items) {
            markers.forEach(m => m.remove()); markers = [];
            items.forEach(item => {
              const el = document.createElement('div');
                  // Set the base class
                  let className = 'vault-marker vault-marker-' + (item.category || 'other');
                  
                  // --- NEW: Add the 'claimed' class if applicable ---
                  if (claimedIds.includes(item.id)) {
                      className += ' claimed';
                  }
                  el.className = className;
              
              el.onclick = (event) => {
                event.stopPropagation();
                postToApp({ type: 'vaultTap', id: item.id });
              };
              const m = new tt.Marker({ element: el }).setLngLat([item.location.longitude, item.location.latitude]).addTo(map);
              markers.push(m);
            });
          }
          map.on('load', () => postToApp({ type: 'MAP_READY' }));
        </script>
      </body></html>`;
  }, [mapCenter]);

  // --- RENDER LOGIC ---

if (!userCoords || !mapCenter) {
    return <SafeAreaView style={styles.loading}><ActivityIndicator size="large" /><Text>Finding location...</Text></SafeAreaView>;
}

return (
    // The main container that holds the map and the modal
    <View style={styles.container}>
        {/* The map is in a SafeAreaView, taking up the full screen behind the modal */}
        <SafeAreaView style={{flex: 1}} edges={['top']}>
            <StatusBar barStyle="dark-content" />
            <WebView
                ref={wv}
                source={{ html: mapHtml }}
                onMessage={onWebMessage}
                style={styles.webview}
            />
            {/* The UI elements on top of the map */}
            <View style={[styles.searchBar, { top: insets.top + theme.spacing.sm }]}>
            <MaterialCommunityIcons 
                name="magnify" 
                size={22} 
                color={theme.colors.lightGrey} 
                style={{ marginRight: theme.spacing.sm }}
            />
            <TextInput 
                style={styles.searchInput} 
                placeholder="Search location..." 
                placeholderTextColor={theme.colors.lightGrey}
                value={searchQuery} 
                onChangeText={setSearchQuery} 
                returnKeyType="search" 
                onSubmitEditing={onSearch}
            />
        </View>
            <TouchableOpacity style={styles.locateButton} onPress={locateMe}>
              <MaterialIcons name="my-location" size={24} color={theme.colors.lightGrey} />
            </TouchableOpacity>
        </SafeAreaView>

        {/* --- THE NEW FLOATING MODAL --- */}
        <Modal
            animationType="fade" // A nice subtle fade in
            transparent={true} // The modal itself is clear, we provide the backdrop
            visible={!!selectedVault} // Controlled by our state
            onRequestClose={() => setSelectedVault(null)} // For Android back button
        >
            {/* The semi-transparent backdrop */}
            <TouchableOpacity 
                style={styles.modalBackdrop} 
                activeOpacity={1} 
                onPressOut={() => setSelectedVault(null)} // Tap outside to close
            >
                {/* The white floating card */}
                <TouchableOpacity activeOpacity={1} style={styles.modalCard}>
                    <View style={styles.cardContent}>
                        {/* --- Header --- */}
                        <View style={styles.cardHeader}>
                            {/* --- NEW LOGO DISPLAY --- */}
                            {selectedVault?.businessLogoUrl ? (
                                <Image 
                                    source={{ uri: selectedVault.businessLogoUrl }} 
                                    style={styles.logoImage} 
                                />
                            ) : (
                                // Fallback for vaults without a logo
                                <View style={styles.logoPlaceholder}>
                                    <MaterialCommunityIcons name="store-outline" size={24} color="#888" />
                                </View>
                            )}

                            <Text style={styles.cardTitle}>{selectedVault?.businessName}</Text>
                        </View>
                        {/* --- Sub-header --- */}
                        <View style={styles.cardSubHeader}>
                            <Text style={styles.cardSubtitle}>"{selectedVault?.publicName}"</Text>
                        </View>

                        <View style={styles.divider} />
                        
                        {/* --- Info Row --- */}
                        <View style={styles.infoRow}>
                            {/* First item */}
                            <View style={styles.infoItem}>
                                <MaterialCommunityIcons name="gift-outline" size={20} color={'#8A8A8E'} />
                                <Text style={styles.infoLabel}>
                                    {(selectedVault?.totalQuantity || 0) - (selectedVault?.claimedQuantity || 0)} Remaining
                                </Text>
                            </View>
                            {/* Second item, now in the same flex container */}
                            <View style={styles.infoItem}>
                                <MaterialCommunityIcons name="map-marker-distance" size={20} color={'#8A8A8E'} />
                                <Text style={styles.infoLabel}>{distance}</Text>
                            </View>
                        </View>
                        {/* --- CTA Button --- */}
                        <TouchableOpacity 
                            style={[styles.ctaButton, isClaimed && styles.ctaButtonDisabled]} 
                            onPress={handleBeginHunt}
                            disabled={isClaimed} // <-- Disable the button if claimed
                        >
                            <Text style={styles.ctaButtonText}>
                                {isClaimed ? "Already Claimed" : "Begin Hunt"}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    </View>
);
}


const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    webview: {
        flex: 1,
    },
    loading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center'
    },
    // Search and Locate Buttons Styles
    searchBar: {
        position: 'absolute',
        left: theme.spacing.md,
        right: theme.spacing.md,
        height: 50,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing.md,
        backgroundColor: 'rgba(30, 30, 30, 0.9)',
        borderRadius: 25,
        borderWidth: 1,
        borderColor: theme.colors.mediumGrey,
        zIndex: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: theme.fontSizes.body,
        color: theme.colors.white,
    },
    locateButton: {
        position: 'absolute',
        right: theme.spacing.md,
        bottom: 100,
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(30, 30, 30, 0.9)',
        borderWidth: 1,
        borderColor: theme.colors.mediumGrey,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    
    // Styles for the Modal
    modalBackdrop: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
    },
    modalCard: {
        width: '90%',
        maxWidth: 380,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 24,
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
    },
    cardContent: {},
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
    },
    logoImage: {
        width: 44,
        height: 44,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: '#f0f0f0'
    },
    logoPlaceholder: {
        width: 44,
        height: 44,
        borderRadius: 8,
        marginRight: 12,
        backgroundColor: '#E5E5EA',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1D1D1F',
        flex: 1,
    },
    cardSubHeader: {
        marginBottom: 20,
    },
    cardSubtitle: {
        fontSize: 16,
        color: '#6E6E73',
        fontStyle: 'italic',
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E5EA',
        width: '100%',
        marginBottom: 20,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    infoItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    infoLabel: {
        fontSize: 16,
        color: '#3C3C43',
        marginLeft: 8,
    },
    ctaButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    ctaButtonDisabled: {
        backgroundColor: '#999', // A clearer disabled color
    },
    ctaButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
});