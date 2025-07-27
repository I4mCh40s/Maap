// src/screens/MapScreen.tsx
import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TextInput,
  TouchableOpacity,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Platform,
  StatusBar,
  Dimensions,
  FlatList,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
  GeoPoint,
  deleteDoc,
  doc,
  Timestamp,
  query,
  where,
  orderBy,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import WebMapView from '../components/WebMapView';
import theme from '../theme';
import { NativeModules, NativeEventEmitter } from 'react-native';

// --- TYPE DEFINITIONS (Simplified for Single-Player Focus) ---

// 'Pin' is now 'Breadcrumb'. This represents a single private memory on the map.
type Breadcrumb = {
  id: string;
  text: string;
  lat: number;
  lng: number;
  ownerId: string;
  createdAt: number;
  listIds?: string[]; // Note: We read 'listIds' from Firestore for compatibility, but think of it as 'trailIds'.
};

// 'PinList' is now 'Trail'. This represents a collection of Breadcrumbs.
type Trail = { 
  id: string; 
  name: string; 
}; 

// --- Get a reference to our new native module ---
const { NFCModule } = NativeModules;
const nfcManagerEmitter = new NativeEventEmitter(NFCModule);


export default function MapScreen({ route, navigation }: any) {
  // --- CORE HOOKS ---
  const insets = useSafeAreaInsets();
  const wv = useRef<WebView>(null);

  // --- STATE MANAGEMENT (Simplified) ---
  const [ready, setReady] = useState(false);
  const [userCoords, setUserCoords] = useState<{lat:number,lng:number}|null>(null);
  const [mapCenter, setMapCenter] = useState<{lat:number,lng:number}|null>(null);
  
  // State for user's private data
  const [personalBreadcrumbs, setPersonalBreadcrumbs] = useState<Breadcrumb[]>([]);
  const [userTrails, setUserTrails] = useState<Trail[]>([]);
  
  // State for the "Create Breadcrumb" modal
  const [breadcrumbCreateModalOpen, setBreadcrumbCreateModalOpen] = useState(false);
  const [newBreadcrumbText, setNewBreadcrumbText] = useState('');
  const [newBreadcrumbCoords, setNewBreadcrumbCoords] = useState<{lat: number, lng: number} | null>(null);
  const [selectedTrailIds, setSelectedTrailIds] = useState<string[]>([]);
  
  // State for the "Breadcrumb Detail" modal
  const [detailBreadcrumb, setDetailBreadcrumb] = useState<Breadcrumb | null>(null);

  // General utility state
  const [searchQuery, setSearchQuery] = useState('');
  const [jsToInject, setJsToInject] = useState<{ code: string; timestamp: number } | undefined>();

  // === NEW STATE FOR NFC MODE ===
  const [isNfcListening, setIsNfcListening] = useState(false);


  // --- EFFECT HOOKS ---

  // === NEW EFFECT for handling NFC events ===
    useEffect(() => {
        const subscription = nfcManagerEmitter.addListener(
            'onNfcTagDiscovered',
            (tagDataString: string) => {
                try {
                    console.log("NFC Tag Data:", tagDataString);
                    const tagData = JSON.parse(tagDataString);

                    // IMPORTANT: Check if it's our app's tag
                    if (tagData.app_id === "maap.breadcrumb.v1" && tagData.name && tagData.lat && tagData.lng) {
                        
                        // We have a valid tag!
                        // Pre-fill the breadcrumb creation state
                        setNewBreadcrumbText(tagData.name);
                        setNewBreadcrumbCoords({ lat: tagData.lat, lng: tagData.lng });

                        // Close the NFC listening modal
                        setIsNfcListening(false);
                        NFCModule.stopNfcListening();
                        
                        // Open the breadcrumb creation modal
                        setBreadcrumbCreateModalOpen(true);

                    } else {
                        // Optional: Handle tags that aren't for our app
                        console.log("Scanned a tag that is not a valid Maap tag.");
                    }
                } catch (error) {
                    console.error("Failed to parse NFC tag data:", error);
                }
            }
        );

        return () => {
            subscription.remove();
        };
    }, []); // Empty dependency array means this runs once on mount

    // === NEW HANDLER for the NFC button press ===
    const handleNfcPress = () => {
        setIsNfcListening(true);
        NFCModule.startNfcListening();
    };

    const cancelNfcScan = () => {
        setIsNfcListening(false);
        NFCModule.stopNfcListening();
    };

  // Handles the '+' button press from the Tab Navigator to open create modal
  useEffect(() => {
    const handleCreateModalOpen = async () => {
      try {
        const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        setNewBreadcrumbCoords({ lat: coords.latitude, lng: coords.longitude });
        setBreadcrumbCreateModalOpen(true);
      } catch (error) {
        console.error("Failed to get current location for breadcrumb:", error);
        Alert.alert("Location Error", "Could not get your current location for the breadcrumb.");
      }
      navigation.setParams({ openCreateModal: undefined });
    };

    if (route.params?.openCreateModal) {
      handleCreateModalOpen();
    }
  }, [route.params?.openCreateModal, navigation]);

  // Handles "fly-to" requests from the Profile screen
  useEffect(() => {
      if (route.params?.flyToCoords) {
          const { lat, lng } = route.params.flyToCoords;
          const js = `map.flyTo({ center: [${lng}, ${lat}], zoom: 17, essential: true });`;
          if (Platform.OS === 'web') {
              setJsToInject({ code: js, timestamp: Date.now() });
          } else {
              wv.current?.injectJavaScript(`${js} true;`);
          }
          navigation.setParams({ flyToCoords: undefined });
      }
  }, [route.params?.flyToCoords]);

  // Fetches the user's Trails to display in the "Create Breadcrumb" modal
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(collection(db, 'pin_lists'), where('ownerId', '==', uid), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, snap => {
        const lists = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
        setUserTrails(lists);
    });
    return unsub;
  }, []);

  // One-time listener to re-center the map if navigated from another screen
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
      if (status !== 'granted') {
        Alert.alert('Permission required', 'This app needs location access to work.');
        return;
      }

      let initialCoords: { lat: number, lng: number } | null = null;
      try {
        const highAccuracyLocation = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        initialCoords = { lat: highAccuracyLocation.coords.latitude, lng: highAccuracyLocation.coords.longitude };
      } catch (error) {
        console.warn("High-accuracy location failed, trying fallback...", error);
        try {
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown) {
            initialCoords = { lat: lastKnown.coords.latitude, lng: lastKnown.coords.longitude };
          }
        } catch (fallbackError) {
          console.error("All location fallbacks failed.", fallbackError);
          Alert.alert("Location Error", "Could not determine your location.");
          return;
        }
      }

      if (initialCoords) {
        setUserCoords(initialCoords);
        setMapCenter(initialCoords);
      }
      
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Highest, timeInterval: 5000, distanceInterval: 10 },
        ({ coords }) => {
          const pos = { lat: coords.latitude, lng: coords.longitude };
          setUserCoords(pos);
          const js = `if (window.userMarker) window.userMarker.setLngLat([${pos.lng}, ${pos.lat}]);`;
          if (Platform.OS === 'web') {
            setJsToInject({ code: js, timestamp: Date.now() });
          } else {
            wv.current?.injectJavaScript(`${js} true;`);
          }
        }
      );
    };

    initializeLocation();
    return () => sub?.remove();
  }, []);

  // Listener for the user's personal breadcrumbs
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setPersonalBreadcrumbs([]); return; }
    // NOTE: This reads from your `pins` collection in Firestore.
    const q = query(collection(db, 'pins'), where('ownerId', '==', uid));
    const unsub = onSnapshot(q, 
      (snap) => {
        const breadcrumbs: Breadcrumb[] = snap.docs.map(d => {
          const data = d.data();
          return { 
            id: d.id, 
            text: data.text, 
            lat: data.location.latitude, 
            lng: data.location.longitude, 
            ownerId: data.ownerId, 
            createdAt: (data.createdAt as Timestamp)?.toMillis() ?? Date.now(),
            listIds: data.listIds || [] 
          };
        });
        setPersonalBreadcrumbs(breadcrumbs);
      },
      (error) => {
        console.error("Firestore Error: Failed to fetch breadcrumbs.", error);
      }
    );
    return unsub;
  }, []);

  // This effect redraws markers on the map whenever the breadcrumbs data changes.
  useEffect(() => {
    if (!ready) return;
    // We only ever render personal breadcrumbs now, simplifying the logic.
    const itemsToRender = personalBreadcrumbs.map(pin => ({ ...pin, renderType: 'pin' }));
    const markerArray = JSON.stringify(itemsToRender);
    const js = `addMarkers(${markerArray});`;
    if (Platform.OS === 'web') { setJsToInject({ code: js, timestamp: Date.now() }); } 
    else { wv.current?.injectJavaScript(`${js} true;`); }
  }, [ready, personalBreadcrumbs]);

  // --- HANDLER FUNCTIONS ---
  
  async function onSubmitBreadcrumb() {
    if (!newBreadcrumbText.trim() || !newBreadcrumbCoords) { Alert.alert("Please enter a note."); return; }
    try {
      // NOTE: Still writing to 'pins' collection and 'listIds' field to match your current Firestore structure.
      await addDoc(collection(db, 'pins'), {
        ownerId: auth.currentUser!.uid,
        text: newBreadcrumbText.trim(),
        location: new GeoPoint(newBreadcrumbCoords.lat, newBreadcrumbCoords.lng),
        createdAt: serverTimestamp(),
        listIds: selectedTrailIds,
      });
      setBreadcrumbCreateModalOpen(false);
      setNewBreadcrumbText('');
      setSelectedTrailIds([]);
    } catch (err: any) { console.error("Failed to create breadcrumb:", err); Alert.alert("Error", "Could not save breadcrumb."); }
  }
  
  const handleTrailSelection = (trailId: string) => {
    setSelectedTrailIds(prevIds => 
      prevIds.includes(trailId) 
        ? prevIds.filter(id => id !== trailId) 
        : [...prevIds, trailId]
    );
  };

  const onDeleteBreadcrumb = async () => {
    if (!detailBreadcrumb) return;
    try {
      await deleteDoc(doc(db, 'pins', detailBreadcrumb.id));
      setDetailBreadcrumb(null);
    } catch (e: any) { Alert.alert('Error deleting breadcrumb', e.message); }
  };

  function onWebMessage(evt: any) {
    try {
      const msg = JSON.parse(evt.nativeEvent.data);
      if (msg.type === 'pinTap') {
        const breadcrumb = personalBreadcrumbs.find(x => x.id === msg.id);
        if (breadcrumb) setDetailBreadcrumb(breadcrumb);
      } else if (msg.type === 'mapTap') {
        setNewBreadcrumbCoords({ lat: msg.lat, lng: msg.lng });
        setBreadcrumbCreateModalOpen(true);
      } else if (msg.type === 'MAP_READY') {
        setReady(true);
      }
    } catch {}
  }
  
  // --- UTILITY FUNCTIONS & MAP HTML ---

  async function locateMe() {
    if (!userCoords) {
      Alert.alert("Location not found", "Still trying to find your location.");
      return;
    }
    
    // --- THIS IS THE FIX ---
    // We are now correctly using the `lng` and `lat` properties
    // that exist on our `userCoords` state object.
    const { lat, lng } = userCoords;

    const js = `map.flyTo({ center: [${lng}, ${lat}], zoom: 15, essential: true });`;

    if (Platform.OS === 'web') {
      setJsToInject({ code: js, timestamp: Date.now() });
    } else {
      wv.current?.injectJavaScript(`${js} true;`);
    }
  }

  async function onSearch() {
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch(`https://api.tomtom.com/search/2/geocode/${encodeURIComponent(searchQuery)}.json?key=YOUR_TOMTOM_API_KEY`);
      const json = await res.json();
      const pos = json.results?.[0]?.position;
      if (pos) {
        setMapCenter({ lat: pos.lat, lng: pos.lon });
      } else { Alert.alert('Not found', 'Could not locate that address.'); }
    } catch (e: any) { Alert.alert('Search failed', e.message); }
  }

  const mapHtml = useMemo(() => {
    if (!mapCenter) return '';
    const TOMTOM_KEY = 'zoyiO1lknbi8bagOcFtqev5TcihUwvbR'; // Your TomTom API Key
    return `
        <!DOCTYPE html><html><head>
          <meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
          <script src="https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps-web.min.js"></script>
          <link href="https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.25.0/maps/maps.css" rel="stylesheet"/>
          <style>
            html,body,#map{margin:0;padding:0;width:100%;height:100%}
            .user-marker {width:12px;height:12px;background:rgba(0,150,255,1);border:2px solid #FFF;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,.4);}
            .pin-marker {width: 24px; height: 24px; border-radius: 50% 50% 50% 0; background: #E53935; position: absolute; transform: translate(-50%, -100%) rotate(-45deg); border: 2px solid #FFF; cursor: pointer;}
          </style>
        </head><body>
          <div id="map"></div>
          <script>
            const postToApp = (msg) => window.ReactNativeWebView?.postMessage(JSON.stringify(msg));
            const map = tt.map({ key: '${TOMTOM_KEY}', container: 'map', center: [${mapCenter?.lng}, ${mapCenter?.lat}], zoom: 14, style: "https://api.tomtom.com/style/2/custom/style/dG9tdG9tQEBAMzJSMkJDa1NmTGNvR2h3RzsO9cOMFdVDGI-DPwgg0BlM.json?key=${TOMTOM_KEY}" });
            window.userMarker = new tt.Marker({ element: document.createElement('div') }).setLngLat([${mapCenter?.lng}, ${mapCenter?.lat}]).addTo(map);
            window.userMarker.getElement().className = 'user-marker';
            map.on('click', (e) => postToApp({ type: 'mapTap', lat: e.lngLat.lat, lng: e.lngLat.lng }));
            let markers = [];
            function addMarkers(items) {
              markers.forEach(m => m.remove()); markers = [];
              items.forEach(item => {
                const el = document.createElement('div');
                el.className = 'pin-marker'; // Only one type of marker now
                el.onclick = (event) => {
                  event.stopPropagation();
                  postToApp({ type: 'pinTap', id: item.id });
                };
                const m = new tt.Marker({ element: el }).setLngLat([item.lng, item.lat]).addTo(map);
                markers.push(m);
              });
            }
            map.on('load', () => postToApp({ type: 'MAP_READY' }));
          </script>
        </body></html>`;
  }, [mapCenter]);

  // --- RENDER LOGIC ---

  if (!userCoords || !mapCenter) { 
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10, color: '#666' }}>Finding your location...</Text>
      </SafeAreaView>
    );
  }
  
  const screenHeight = Dimensions.get('window').height;
  const verticalCenterOffset = (screenHeight / 2) - 80;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" />
        {
          Platform.OS === 'web' 
            ? <WebMapView html={mapHtml} onMessage={onWebMessage} jsToInject={jsToInject} />
            : <WebView ref={wv} source={{ html: mapHtml }} originWhitelist={['*']} onLoadEnd={() => setReady(true)} onMessage={onWebMessage} style={styles.webview} />
        }
      
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

      {/* === NEW NFC BUTTON === */}
            <TouchableOpacity style={styles.nfcButton} onPress={handleNfcPress}>
                <MaterialCommunityIcons name="nfc-variant" size={24} color={theme.colors.lightGrey} />
            </TouchableOpacity>

            {/* === NEW MODAL TO SHOW WHILE LISTENING FOR TAGS === */}
            <Modal visible={isNfcListening} transparent animationType="fade">
                <View style={styles.backdrop}>
                    <View style={styles.modalCard}>
                        <MaterialCommunityIcons name="nfc-search-variant" size={60} color={theme.colors.primary} style={{alignSelf: 'center'}} />
                        <Text style={styles.modalTitle}>Ready to Scan</Text>
                        <Text style={styles.message}>Hold your phone near a Maap NFC tag.</Text>
                        <TouchableOpacity onPress={cancelNfcScan} style={[styles.actionButton, {backgroundColor: theme.colors.mediumGrey}]}>
                            <Text style={styles.actionLabel}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

      <Modal visible={breadcrumbCreateModalOpen} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <TouchableOpacity onPress={() => { setBreadcrumbCreateModalOpen(false); setNewBreadcrumbText(''); setSelectedTrailIds([]); }} style={styles.closeButton}><MaterialCommunityIcons name="close" size={24} /></TouchableOpacity>
            <Text style={styles.modalTitle}>New Breadcrumb</Text>
            <TextInput style={styles.messageInput} placeholder="Note, reminder, memory..." value={newBreadcrumbText} onChangeText={setNewBreadcrumbText} multiline />
            <Text style={styles.listSelectionTitle}>Add to a Trail (optional)</Text>
            <View style={styles.listSelectionContainer}>
              {userTrails.length > 0 ? (
                <FlatList
                    data={userTrails}
                    keyExtractor={item => item.id}
                    renderItem={({item}) => {
                        const isSelected = selectedTrailIds.includes(item.id);
                        return (
                            <TouchableOpacity
                                style={[styles.listSelectItem, isSelected && styles.listSelectItemActive]}
                                onPress={() => handleTrailSelection(item.id)}
                            >
                                <Text style={[styles.listSelectItemText, isSelected && styles.listSelectItemTextActive]}>{item.name}</Text>
                            </TouchableOpacity>
                        )
                    }}
                />
              ) : (
                <Text style={styles.noListsText}>No Trails created yet. Go to your profile to create one!</Text>
              )}
            </View>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionButton} onPress={() => { setBreadcrumbCreateModalOpen(false); setNewBreadcrumbText(''); setSelectedTrailIds([]); }}><Text style={styles.actionLabel}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.saveButton]} onPress={onSubmitBreadcrumb}><Text style={[styles.actionLabel, { color: '#fff' }]}>Save Breadcrumb</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!detailBreadcrumb} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <TouchableOpacity onPress={() => setDetailBreadcrumb(null)} style={styles.closeButton}><MaterialCommunityIcons name="close" size={24} /></TouchableOpacity>
            <Text style={styles.modalTitle}>Your Breadcrumb</Text>
            <Text style={styles.message}>{detailBreadcrumb?.text}</Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity onPress={onDeleteBreadcrumb} style={[styles.actionButton, styles.deleteButton]}>
                <MaterialCommunityIcons name="trash-can-outline" size={20} color="#fff" />
                <Text style={[styles.actionLabel, { color: '#fff' }]}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// --- STYLES (Cleaned Up) ---
const styles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', },
  webview: { flex: 1, zIndex: -1 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end', // This moves the modal to the bottom
  },
  modalCard: {
    width: '100%',
    backgroundColor: theme.colors.darkGrey,
    // Rounded corners only on top for bottom-sheet effect
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: theme.spacing.lg,
    paddingBottom: 40, // Extra padding at the bottom
  },
  closeButton: { position: 'absolute', top: theme.spacing.md, right: theme.spacing.md, zIndex: 1, },
  modalTitle: { 
    fontSize: theme.fontSizes.h3, 
    fontWeight: '700',
    color: theme.colors.white,
    textAlign: 'center', 
    marginBottom: theme.spacing.md,
  },
  message: {
    fontSize: theme.fontSizes.body,
    color: theme.colors.white, // <<--- FIX: Changed from dark to white
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
    lineHeight: 22 
  },
  actionsRow: { 
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
  },
  actionButton: { 
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.spacing.md,
    borderRadius: 12,
  },
  deleteButton: { 
    backgroundColor: theme.colors.danger 
  },
  saveButton: { 
    backgroundColor: theme.colors.primary 
  },
  actionLabel: { 
    marginLeft: theme.spacing.sm,
    fontSize: theme.fontSizes.body,
    fontWeight: '600',
    color: theme.colors.white,
  },
  searchBar: {
    position: 'absolute',
    left: theme.spacing.md,
    right: theme.spacing.md,
    top: 50, // Or insets.top + theme.spacing.sm
    height: 50,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    backgroundColor: 'rgba(30, 30, 30, 0.9)', // Translucent dark grey
    borderRadius: 25, // Fully rounded ends
    borderWidth: 1,
    borderColor: theme.colors.mediumGrey,
    zIndex: 10,
},
searchInput: {
    flex: 1,
    fontSize: theme.fontSizes.body,
    color: theme.colors.white,
},
  searchButton: { width: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: '#007AFF', },
  searchButtonText: { color: '#FFF', fontWeight: '600', fontSize: 16, },
  messageInput: { 
    backgroundColor: theme.colors.black,
    borderWidth: 1, borderColor: theme.colors.mediumGrey,
    borderRadius: 12, padding: theme.spacing.md, minHeight: 100,
    textAlignVertical: 'top', marginBottom: theme.spacing.lg,
    fontSize: theme.fontSizes.body, color: theme.colors.white,
  },
  locateButton: {
    position: 'absolute',
    right: theme.spacing.md,
    bottom: 100, // Position it above the tab bar
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(30, 30, 30, 0.9)', // Match the search bar
    borderWidth: 1,
    borderColor: theme.colors.mediumGrey,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
},
  listSelectionTitle: { fontSize: 14, fontWeight: '600', color: theme.colors.lightGrey, marginBottom: 8, },
  listSelectionContainer: { maxHeight: 120, borderWidth: 1, borderColor: theme.colors.mediumGrey, borderRadius: 8, marginBottom: 16, },
  listSelectItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.mediumGrey, },
  listSelectItemActive: { backgroundColor: theme.colors.primary_light+'33', }, // semi-transparent accent
  listSelectItemText: { color: theme.colors.white, },
  listSelectItemTextActive: { fontWeight: 'bold', color: theme.colors.primary, },
  noListsText: { padding: 12, textAlign: 'center', color: '#999', fontStyle: 'italic', },
  nfcButton: {
        position: 'absolute',
        right: theme.spacing.md,
        bottom: 160, // Position it above the locateMe button
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
});