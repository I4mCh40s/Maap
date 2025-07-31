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
  Modal
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import { collection, onSnapshot, query, where, orderBy, startAt, endAt, Unsubscribe } from 'firebase/firestore';
import { db } from '../firebase';
import WebMapView from '../components/WebMapView';
import theme from '../theme';
import { geohashQueryBounds } from 'geofire-common';
import { Vault } from '../core/types';
import { calculateDistance } from '../core/utils';



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

  // Core location tracking logic
  useEffect(() => {
    let sub: Location.LocationSubscription | undefined;
    const initializeLocation = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      
      const initialLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const initialCoords = { lat: initialLocation.coords.latitude, lng: initialLocation.coords.longitude };
      setUserCoords(initialCoords);
      setMapCenter(initialCoords);

      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Highest, timeInterval: 5000, distanceInterval: 10 },
        ({ coords }) => {
          const pos = { lat: coords.latitude, lng: coords.longitude };
          setUserCoords(pos);
          const js = `if (window.userMarker) window.userMarker.setLngLat([${pos.lng}, ${pos.lat}]);`;
          wv.current?.injectJavaScript(`${js} true;`);
        }
      );
    };
    initializeLocation().catch(console.error);
    return () => sub?.remove();
  }, []);

  // Listener for geohashed vaults
  // src/screens/MapScreen.tsx

// --- REPLACE THE ENTIRE V VAULT LISTENER useEffect WITH THIS ---

useEffect(() => {
    if (!userCoords) return;

    const center = [userCoords.lat, userCoords.lng] as [number, number];
    const radiusInM = 10 * 1000; // 10km radius
    const bounds = geohashQueryBounds(center, radiusInM);
    
    // This creates an array of unsubscribe functions, one for each query.
    const unsubscribes = bounds.map(b => {
      const q = query(
        collection(db, 'vaults'),
        orderBy('geohash'),
        startAt(b[0]),
        endAt(b[1]),
        where('isActive', '==', true)
      );

      // Return the unsubscribe function provided by onSnapshot
      return onSnapshot(q, (snapshot) => {
        // Use docChanges() to get granular updates
        snapshot.docChanges().forEach((change) => {
          const vaultData = { id: change.doc.id, ...change.doc.data() } as Vault;

          if (change.type === 'removed') {
            console.log("Vault REMOVED:", vaultData.id);
            // If a vault is removed, filter it out of the current state
            setVaults(prevVaults => prevVaults.filter(v => v.id !== vaultData.id));

          } else { // This handles both 'added' and 'modified' types
            console.log("Vault ADDED or MODIFIED:", vaultData.id);
            setVaults(prevVaults => {
              // Create a Map from the previous state for efficient lookups
              const vaultMap = new Map(prevVaults.map(v => [v.id, v]));
              // Add or update the new/changed vault
              vaultMap.set(vaultData.id, vaultData);
              // Convert the Map back to an array to set the new state
              return Array.from(vaultMap.values());
            });
          }
        });
      });
    });

    // When the component unmounts or userCoords change, call all unsubscribe functions
    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
}, [userCoords]);

  // Redraws markers on map
  useEffect(() => {
    if (!ready || !vaults) return;
    const markerArray = JSON.stringify(vaults);
    const js = `addMarkers(${markerArray});`;
    wv.current?.injectJavaScript(`${js} true;`);
  }, [ready, vaults]);

  
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

  // --- WebView HTML ---

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
          .vault-marker { width: 28px; height: 28px; background: #FFD700; border: 2px solid #FFF; border-radius: 50%; cursor: pointer; display: flex; justify-content: center; align-items: center; font-size: 16px; font-weight: bold; color: #8B4513; box-shadow: 0 0 8px rgba(0,0,0,0.5); }
          .vault-marker::after { content: 'V'; }
        </style>
      </head><body>
        <div id="map"></div>
        <script>
          const postToApp = (msg) => window.ReactNativeWebView?.postMessage(JSON.stringify(msg));
          const map = tt.map({ key: '${TOMTOM_KEY}', container: 'map', center: [${mapCenter.lng}, ${mapCenter.lat}], zoom: 14, style: "https://api.tomtom.com/style/2/custom/style/dG9tdG9tQEBAMzJSMkJDa1NmTGNvR2h3RzsO9cOMFdVDGI-DPwgg0BlM.json?key=${TOMTOM_KEY}" });
          window.userMarker = new tt.Marker({ element: document.createElement('div') }).setLngLat([${mapCenter.lng}, ${mapCenter.lat}]).addTo(map);
          window.userMarker.getElement().className = 'user-marker';
          
          let markers = [];
          function addMarkers(items) {
            markers.forEach(m => m.remove()); markers = [];
            items.forEach(item => {
              const el = document.createElement('div');
              el.className = 'vault-marker';
              el.onclick = (event) => {
                event.stopPropagation();
                console.log('WebView CLICKED on vault ID: ' + item.id);
                postToApp({ type: 'vaultTap', id: item.id }); };
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
                {/* Search Bar Content */}
            </View>
            <TouchableOpacity style={styles.locateButton} onPress={locateMe}>
                {/* Locate Button Icon */}
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
                            <Text style={styles.cardTitle}>{selectedVault?.businessName}</Text>
                        </View>
                        {/* --- Sub-header --- */}
                        <View style={styles.cardSubHeader}>
                            <Text style={styles.cardSubtitle}>"{selectedVault?.publicName}"</Text>
                        </View>

                        <View style={styles.divider} />
                        
                        {/* --- Info Row --- */}
                        <View style={styles.infoRow}>
                            <MaterialCommunityIcons name="gift-outline" size={20} color={'#8A8A8E'} />
                            <Text style={styles.infoLabel}>Rewards Remaining:</Text>
                            <Text style={styles.infoValue}>
                                {(selectedVault?.totalQuantity || 0) - (selectedVault?.claimedQuantity || 0)}
                            </Text>
                        </View>
                        {/* --- NEW DISTANCE ITEM --- */}
                        <View style={styles.infoItem}>
                            <MaterialCommunityIcons name="map-marker-distance" size={20} color={'#8A8A8E'} />
                            <Text style={styles.infoLabel}>{distance}</Text>
                        </View>
                        {/* --- CTA Button --- */}
                        <TouchableOpacity style={styles.ctaButton} onPress={handleBeginHunt}>
                            <Text style={styles.ctaButtonText}>Begin Hunt</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    </View>
);
}


// --- NEW STYLES OBJECT FOR THE FLOATING CARD ---
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
    searchBar: { /* Your existing searchBar styles */ },
    locateButton: { /* Your existing locateButton styles */ },
    
    // Styles for the new Modal
    modalBackdrop: {
        flex: 1,
        justifyContent: 'center', // Center the card vertically
        alignItems: 'center',     // Center the card horizontally
        backgroundColor: 'rgba(0, 0, 0, 0.4)', // Semi-transparent black
    },
    modalCard: {
        width: '90%',
        maxWidth: 380, // A max width for larger devices
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 24,
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: 4,
        },
        shadowOpacity: 0.25,
        shadowRadius: 12,
    },
    cardContent: {}, // Wrapper for content if needed
    cardHeader: {
        marginBottom: 8,
    },
    cardTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1D1D1F',
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
    justifyContent: 'space-between', // <-- CHANGE THIS
    marginBottom: 24,
},
    infoLabel: {
        fontSize: 16,
        color: '#3C3C43',
        marginLeft: 8,
    },
    infoItem: { // <-- NEW STYLE
    flexDirection: 'row',
    alignItems: 'center',
},
    infoValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#1D1D1F',
        marginLeft: 'auto',
    },
    ctaButton: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 16,
        borderRadius: 12,
        alignItems: 'center',
    },
    ctaButtonText: {
        color: 'white',
        fontSize: 18,
        fontWeight: 'bold',
    },
});