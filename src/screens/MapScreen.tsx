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
  NativeModules,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';
import TopShoutsPanel from '../components/TopShoutsPanel';

import {
  collection,
  onSnapshot,
  addDoc,
  getDoc,
  serverTimestamp,
  GeoPoint,
  deleteDoc,
  doc,
  Timestamp,
  runTransaction,
  arrayUnion,
  increment,
  updateDoc,
  where,
  query,
  orderBy,
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import WebMapView from '../components/WebMapView';

function getDistanceMeters(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const toRad = (x: number) => x * Math.PI / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const R = 6371000; // earth radius in meters
  return R * c;
}

type PublicItem = {
  id: string;
  type: 'shout' | 'spot';
  text: string;
  lat: number;
  lng: number;
  authorName: string;
  ownerId: string;
  createdAt: number;
  expiresAt: Timestamp;
  likeCount: number;
  likedBy: string[];
  radius: number;
  authorIsVerified: boolean;
  authorIsMerchant: boolean;
};

type Pin = {
  id: string;
  text: string;
  lat: number;
  lng: number;
  ownerId: string;
  createdAt: number;
  listIds?: string[];
};

type PinList = { id: string; name: string; }; // Simple type for lists

let lastKnownUserCoords: { lat: number, lng: number } | null = null;

// =================================================================================================
// --- NATIVE MODULE BRIDGE ---
// =================================================================================================

// Get a reference to your custom module
const { MyARModule } = NativeModules;



export default function MapScreen({ route, navigation }: any) {
  // --- ALL HOOKS MUST BE CALLED HERE, AT THE TOP ---
  const insets = useSafeAreaInsets();
  const wv = useRef<WebView>(null);

  // State Hooks
  const [ready, setReady] = useState(false);
  const [userCoords, setUserCoords] = useState<{lat:number,lng:number}|null>(null);
  const [mapCenter, setMapCenter] = useState<{lat:number,lng:number}|null>(null);
  const [mapMode, setMapMode] = useState<'pins' | 'public'>('pins');
  const [publicItems, setPublicItems] = useState<PublicItem[]>([]);
  const [personalPins, setPersonalPins] = useState<Pin[]>([]);
  const [createPublicItemModalOpen, setCreatePublicItemModalOpen] = useState(false);
  const [newPublicItemText, setNewPublicItemText] = useState('');
  const [newPublicItemType, setNewPublicItemType] = useState<'shout' | 'spot'>('shout');
  const [pinCreateModalOpen, setPinCreateModalOpen] = useState(false);
  const [newPinText, setNewPinText] = useState('');
  const [newPinCoords, setNewPinCoords] = useState<{lat: number, lng: number} | null>(null);
  const [userPinLists, setUserPinLists] = useState<PinList[]>([]);
  const [selectedListIds, setSelectedListIds] = useState<string[]>([]);
  const [detailPin, setDetailPin] = useState<Pin | null>(null);
  const [promoteChoiceModalOpen, setPromoteChoiceModalOpen] = useState(false);
  const [promotionCoords, setPromotionCoords] = useState<{lat: number, lng: number} | null>(null);
  const [detailItem, setDetailItem] = useState<PublicItem|null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [jsToInject, setJsToInject] = useState<{ code: string; timestamp: number } | undefined>();
  const [activePinListFilter, setActivePinListFilter] = useState<string>('all');
  
  const visiblePublicItems = useMemo(() => {
      if (!userCoords) return [];
      return publicItems.filter(s => {
        const distance = getDistanceMeters(userCoords.lat, userCoords.lng, s.lat, s.lng);
        return distance <= s.radius;
      });
    }, [publicItems, userCoords]);

  // NEW: Memoized array of pins to display based on the active filter
  const filteredPersonalPins = useMemo(() => {
    if (activePinListFilter === 'all') {
      return personalPins;
    }
    return personalPins.filter(pin => pin.listIds?.includes(activePinListFilter));
  }, [personalPins, activePinListFilter]);

  

  // NEW: Data for the filter pills, including the "All" option
  const filterPills = useMemo(() => [{ id: 'all', name: 'All pins' }, ...userPinLists], [userPinLists]);

// Helper function to convert Lat/Lng difference into local AR meters [x, y, z]
const getOffsetFromGPS = (
  userLat: number, userLng: number,
  shoutLat: number, shoutLng: number
): [number, number, number] => {
  const toRad = (x: number) => x * Math.PI / 180;
  const R = 6371000; // Earth radius in meters

  const dLat = toRad(shoutLat - userLat);
  const dLng = toRad(shoutLng - userLng);
  
  // Convert latitude and longitude differences to meters
  // x is East(+) / West(-)
  // z is South(+) / North(-)
  const x = dLng * Math.cos(toRad(userLat)) * R;
  const z = dLat * R;
  
  // ARCore's coordinate system: +X is right (East), +Y is up, -Z is forward (North)
  // We place shouts at eye level, so y=0
  return [x, 0, -z];
};

const launchAR = () => {
  if (Platform.OS !== 'android' || !MyARModule) {
    Alert.alert("Unsupported", "AR features are not available on this device.");
    return;
  }

  // Ensure we have the user's current location to act as the "center of the universe"
  if (!userCoords) {
      Alert.alert("Location Unknown", "Could not get your current location. Please wait a moment and try again.");
      return;
  }

  if (visiblePublicItems.length === 0) {
    Alert.alert("No Shouts Nearby", "There are no public shouts in your immediate vicinity. Try walking around or create one!");
    return;
  }

  // Format the data for our native module, converting GPS to local AR coordinates for each shout
  const shoutsForAR = visiblePublicItems.map(item => ({
    id: item.id,
    text: item.text,
    position: getOffsetFromGPS(userCoords.lat, userCoords.lng, item.lat, item.lng)
  }));

  const shoutsJsonString = JSON.stringify(shoutsForAR);
  
  // This calls the correct function, which is already in your MyARModule.kt
  MyARModule.launchARActivityWithShouts(shoutsJsonString);
};


  useEffect(() => {
    const handleCreateModalOpen = async () => {
      if (mapMode === 'public') {
        setPromotionCoords(null); 
        setNewPublicItemType('shout');
        setCreatePublicItemModalOpen(true);
      } 
      else { // mapMode is 'pins'
        try {
          const { coords } = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
          setNewPinCoords({ lat: coords.latitude, lng: coords.longitude });
          setPinCreateModalOpen(true);
        } catch (error) {
          console.error("Failed to get current location for pin:", error);
          Alert.alert("Location Error", "Could not get your current location for the pin.");
        }
      }
      navigation.setParams({ openCreateModal: undefined });
    };

    if (route.params?.openCreateModal) {
      handleCreateModalOpen();
    }
  }, [route.params?.openCreateModal, mapMode, navigation]);

  // FIX: Add this new useEffect to handle the "fly-to" request
    useEffect(() => {
        if (route.params?.flyToCoords) {
            const { lat, lng } = route.params.flyToCoords;

            // Use a higher zoom level to focus on the specific pin
            const js = `map.flyTo({ center: [${lng}, ${lat}], zoom: 17, essential: true });`;

            if (Platform.OS === 'web') {
                setJsToInject({ code: js, timestamp: Date.now() });
            } else {
                wv.current?.injectJavaScript(`${js} true;`);
            }

            // IMPORTANT: Clear the param so it doesn't run again on re-render
            navigation.setParams({ flyToCoords: undefined });
        }
    }, [route.params?.flyToCoords]); // This effect runs only when flyToCoords changes

  // NEW useEffect to fetch the user's pin lists for the modal
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const q = query(collection(db, 'pin_lists'), where('ownerId', '==', uid), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, snap => {
        const lists = snap.docs.map(d => ({ id: d.id, name: d.data().name }));
        setUserPinLists(lists);
    });
    return unsub;
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (route.params?.shouldRecenter) {
        locateMe();
        navigation.setParams({ shouldRecenter: undefined });
      }
    });
    return unsubscribe;
  }, [navigation, route.params]);

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
        const highAccuracyLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        initialCoords = {
          lat: highAccuracyLocation.coords.latitude,
          lng: highAccuracyLocation.coords.longitude,
        };
      } catch (error) {
        console.warn("High-accuracy location failed, falling back...", error);
        try {
          const lastKnown = await Location.getLastKnownPositionAsync();
          if (lastKnown) {
            initialCoords = {
              lat: lastKnown.coords.latitude,
              lng: lastKnown.coords.longitude,
            };
          } else {
            const balancedLocation = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });
             initialCoords = {
              lat: balancedLocation.coords.latitude,
              lng: balancedLocation.coords.longitude,
            };
          }
        } catch (fallbackError) {
          console.error("All location fallbacks failed.", fallbackError);
          Alert.alert("Location Error", "Could not determine your location. Please check your device's location settings.");
          return;
        }
      }

      if (initialCoords) {
        lastKnownUserCoords = initialCoords;
        setUserCoords(initialCoords);
        setMapCenter(initialCoords);
      }
      
      sub = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Highest, timeInterval: 5000, distanceInterval: 10 },
        ({ coords }) => {
          const pos = { lat: coords.latitude, lng: coords.longitude };
          lastKnownUserCoords = pos; 
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

  // PART 1: A simple listener to get all currently active public items.
  useEffect(() => {
    // This query is efficient because it only asks for items that haven't expired yet.
    const q = query(collection(db, 'public_items'), where('expiresAt', '>', Timestamp.now()));
    
    const unsub = onSnapshot(q, (snap) => {
      const items: PublicItem[] = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, type: data.type, text: data.text,
          lat: data.location.latitude, lng: data.location.longitude,
          authorName: data.authorName, ownerId: data.ownerId,
          createdAt: (data.createdAt as Timestamp)?.toMillis() ?? Date.now(),
          expiresAt: data.expiresAt, likeCount: data.likeCount || 0,
          likedBy: data.likedBy || [], radius: data.radius || 500,
          authorIsVerified: data.authorIsVerified ?? false,
          authorIsMerchant: data.authorIsMerchant ?? false,
        };
      });
      setPublicItems(items);
    });

    return unsub;
  }, []);

  // PART 2: An active timer that finds expired items in the state and deletes them from the database.
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      const now = Date.now();
      // Find items in our current state that have now expired.
      const expiredItems = publicItems.filter(item => item.expiresAt.toMillis() <= now);

      if (expiredItems.length > 0) {
        // If we find any, we trigger their deletion from Firestore.
        // This will cause the onSnapshot listener above to run, automatically updating the UI.
        console.log(`Deleting ${expiredItems.length} expired item(s) from Firestore.`);
        expiredItems.forEach(item => {
          const itemRef = doc(db, 'public_items', item.id);
          deleteDoc(itemRef).catch(err => {
            console.error(`Failed to delete expired item ${item.id}:`, err);
          });
        });
      }
    }, 60000); // Check every minute.

    return () => clearInterval(cleanupInterval); // Important: clear the interval on unmount.
  }, [publicItems]); // This effect depends on the publicItems state.

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) { setPersonalPins([]); return; }
    const q = query(collection(db, 'pins'), where('ownerId', '==', uid));
    const unsub = onSnapshot(q, 
      (snap) => {
        const pins: Pin[] = snap.docs.map(d => {
          const data = d.data();
          return { 
            id: d.id, 
            text: data.text, 
            lat: data.location.latitude, 
            lng: data.location.longitude, 
            ownerId: data.ownerId, 
            createdAt: (data.createdAt as Timestamp)?.toMillis() ?? Date.now(),
            // This line was missing. It's now added.
            listIds: data.listIds || [] 
          };
        });
        setPersonalPins(pins);
      },
      (error) => {
        console.error("Firestore Error: Failed to fetch pins. Ensure your `pins` collection has an index on `ownerId`.", error);
      }
    );
    return unsub;
  }, []);

  
  useEffect(() => {
    if (!ready) return;
    let itemsToRender: any[] = [];
    if (mapMode === 'public') {
      itemsToRender = visiblePublicItems.map(item => ({ ...item, renderType: item.type }));
    } else {
      itemsToRender = filteredPersonalPins.map(pin => ({ ...pin, renderType: 'pin' }));
    }
    const markerArray = JSON.stringify(itemsToRender);
    const js = `addMarkers(${markerArray});`;
    if (Platform.OS === 'web') { setJsToInject({ code: js, timestamp: Date.now() }); } 
    else { wv.current?.injectJavaScript(`${js} true;`); }
  }, [ready, visiblePublicItems, filteredPersonalPins, mapMode]);

  async function onSubmitPublicItem() {
    try {
      if (!newPublicItemText.trim()) { Alert.alert('Please enter a message'); return; }
      const uid = auth.currentUser!.uid;
      const userDoc = await getDoc(doc(db, 'users', uid));
      const isMerchant = userDoc.data()?.isMerchant ?? false;
      const initialRadius = isMerchant ? 750 : 500;
      let lifespanSeconds = newPublicItemType === 'spot' ? 7 * 24 * 60 * 60 : 60 * 60;
      const expiresAt = Timestamp.fromMillis(Date.now() + lifespanSeconds * 1000);

      const locationToUse = promotionCoords || userCoords;
      if (!locationToUse) {
        Alert.alert("Location Error", "Could not determine your location to post.");
        return;
      }
      const location = new GeoPoint(locationToUse.lat, locationToUse.lng);

      const payload = {
        type: newPublicItemType,
        text: newPublicItemText.trim(),
        authorName: auth.currentUser?.displayName || 'Anonymous',
        ownerId: uid,
        location: location,
        createdAt: serverTimestamp(),
        expiresAt,
        radius: initialRadius,
        likeCount: 0,
        likedBy: [],
        authorIsVerified: userDoc.data()?.isVerified ?? false,
        authorIsMerchant: isMerchant,
      };

      await addDoc(collection(db, 'public_items'), payload);
      setNewPublicItemText('');
      setCreatePublicItemModalOpen(false);
      setPromotionCoords(null); 
    } catch (err: any) { console.error('onSubmitPublicItem failed:', err); Alert.alert('Error', err.message); }
  }

  // MODIFIED ACTION: Submit new private pin
  async function onSubmitPin() {
    if (!newPinText.trim() || !newPinCoords) { Alert.alert("Please enter a note."); return; }
    try {
      await addDoc(collection(db, 'pins'), {
        ownerId: auth.currentUser!.uid,
        text: newPinText.trim(),
        location: new GeoPoint(newPinCoords.lat, newPinCoords.lng),
        createdAt: serverTimestamp(),
        listIds: selectedListIds, // <-- ADD THE SELECTED LIST IDs
      });
      setPinCreateModalOpen(false);
      setNewPinText('');
      setSelectedListIds([]); // <-- RESET after submission
    } catch (err: any) { console.error("Failed to create pin:", err); Alert.alert("Error", "Could not save pin."); }
  }
  
  const handleListSelection = (listId: string) => {
    if (selectedListIds.includes(listId)) {
        setSelectedListIds(selectedListIds.filter(id => id !== listId));
    } else {
        setSelectedListIds([...selectedListIds, listId]);
    }
  };

  function onWebMessage(evt: any) {
    try {
      const msg = JSON.parse(evt.nativeEvent.data);
      if (msg.type === 'publicItemTap') {
        const item = publicItems.find(x => x.id === msg.id);
        if (item) setDetailItem(item);
      } else if (msg.type === 'pinTap') {
        const pin = personalPins.find(x => x.id === msg.id);
        if (pin) setDetailPin(pin);
      } else if (msg.type === 'mapTap' && mapMode === 'pins') {
        setNewPinCoords({ lat: msg.lat, lng: msg.lng });
        setPinCreateModalOpen(true);
      } else if (msg.type === 'MAP_READY') {
        setReady(true);
      }
    } catch {}
  }

  // *** FUNCTION RESTORED ***
  // MAP HTML
  const TOMTOM_KEY = 'zoyiO1lknbi8bagOcFtqev5TcihUwvbR'; 
  function buildTomTomHtml(center: { lat: number; lng: number; }): string {
    return `
        <!DOCTYPE html><html><head>
          <meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
          <script src="https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.14.0/maps/maps-web.min.js"></script>
          <link href="https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.14.0/maps/maps.css" rel="stylesheet"/>
          <style>
            html,body,#map{margin:0;padding:0;width:100%;height:100%}
            .user-marker  {width:10px;height:10px;background:rgba(0,150,136,.8);border:2px solid #FFF;border-radius:50%;box-shadow:0 0 4px rgba(0,0,0,.3);transform:translate(-50%,-50%);z-index:1}
            .shout-marker {width:15px;height:15px;background:#007AFF;border:2px solid #FFF;border-radius:50%;cursor:pointer;z-index:2}
            .spot-marker {width:18px;height:18px;background:#FFD600;border:2px solid #FFF;border-radius:50%;cursor:pointer;z-index:2; box-shadow: 0 0 8px #FFD600;}
            .pin-marker {width: 24px; height: 24px; border-radius: 50% 50% 50% 0; background: #4CAF50; position: absolute; transform: translate(-50%, -100%) rotate(-45deg); border: 2px solid #FFF; cursor: pointer; z-index: 2;}
          </style>
        </head><body>
          <div id="map"></div>
          <script>
            const postToApp = (message) => { window.ReactNativeWebView?.postMessage(message); };
            const map = tt.map({ key: '${TOMTOM_KEY}', container: 'map', center: [${center?.lng}, ${center?.lat}], zoom: 14, style: "https://api.tomtom.com/style/2/custom/style/dG9tdG9tQEBAMzJSMkJDa1NmTGNvR2h3RzsO9cOMFdVDGI-DPwgg0BlM.json?key=${TOMTOM_KEY}" });
            window.userMarker = new tt.Marker({ element: document.createElement('div') }).setLngLat([${center?.lng}, ${center?.lat}]).addTo(map);
            window.userMarker.getElement().className = 'user-marker';
            
            map.on('click', (e) => postToApp(JSON.stringify({ type: 'mapTap', lat: e.lngLat.lat, lng: e.lngLat.lng })));

            let markers = [];
            function addMarkers(items) {
              markers.forEach(m => m.remove());
              markers = [];
              items.forEach(item => {
                const el = document.createElement('div');
                el.className = item.renderType + '-marker';
                
                el.onclick = (event) => {
                  event.stopPropagation();
                  if(item.renderType === 'shout' || item.renderType === 'spot') {
                    postToApp(JSON.stringify({ type: 'publicItemTap', id: item.id }));
                  } else { // pin
                    postToApp(JSON.stringify({ type: 'pinTap', id: item.id }));
                  }
                };

                if(item.renderType === 'shout' || item.renderType === 'spot') {
                    const size = 15 + Math.sqrt(item.likeCount || 0) * 4;
                    el.style.width = size + 'px';
                    el.style.height = size + 'px';
                }

                const m = new tt.Marker({ element: el }).setLngLat([item.lng, item.lat]).addTo(map);
                markers.push(m);
              });
            }
            map.on('load', () => postToApp(JSON.stringify({ type: 'MAP_READY' })));
            document.addEventListener('message', (e) => { try { const data = JSON.parse(e.data); if(data.code) eval(data.code); } catch {} });
          </script>
        </body></html>`;
  }
  
  const mapHtml = useMemo(() => {
    if (!mapCenter) return '';
    return buildTomTomHtml(mapCenter);
  }, [mapCenter]);
    
  if (!userCoords) { 
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10, color: '#666' }}>Finding your location...</Text>
      </SafeAreaView>
    );
  }

  const isOwner = detailItem?.ownerId === auth.currentUser?.uid;
  const minutesLeft = detailItem ? Math.max(0, Math.ceil((detailItem.expiresAt.toMillis() - Date.now()) / 60000)) : 0;

  async function locateMe() {
    if (!userCoords) return;
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      const { latitude, longitude } = pos.coords;
      const js = `map.flyTo({ center: [${longitude}, ${latitude}], zoom: 15 });`;
      if (Platform.OS === 'web') { setJsToInject({ code: js, timestamp: Date.now() }); } 
      else { wv.current?.injectJavaScript(`${js} true;`); }
    } catch (e) { console.error("locateMe failed:", e); Alert.alert("Error", "Could not get current location."); }
  }

  async function onSearch() {
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch(`https://api.tomtom.com/search/2/geocode/${encodeURIComponent(searchQuery)}.json?key=${TOMTOM_KEY}`);
      const json = await res.json();
      const pos  = json.results?.[0]?.position;
      if (pos) {
        setMapCenter({ lat: pos.lat, lng: pos.lon });
        const recenterJS = `map.setCenter([${pos.lon}, ${pos.lat}]);`;
        if (Platform.OS === 'web') { setJsToInject({ code: recenterJS, timestamp: Date.now() }); } 
        else { wv.current?.injectJavaScript(`${recenterJS} true;`); }
      } else { Alert.alert('Not found', 'Could not locate that address.'); }
    } catch (e: any) { Alert.alert('Search failed', e.message); }
  }

  const currentUid = auth.currentUser?.uid ?? '';
  const isLiked = !!detailItem && detailItem.likedBy.includes(currentUid);

  const onLikePress = async () => {
    if (!detailItem || isLiked) return;
    const itemRef = doc(db, 'public_items', detailItem.id);
    await runTransaction(db, async tx => {
      const snap = await tx.get(itemRef);
      const data = snap.data() as any;
      if ((data.likedBy || []).includes(currentUid)) return;
      const updates: any = {
        likedBy: arrayUnion(currentUid),
        likeCount: increment(1),
        radius: increment(100)
      };
      if (data.type === 'spot') {
        const oneDayInSeconds = 24 * 60 * 60;
        updates.expiresAt = new Timestamp(data.expiresAt.seconds + oneDayInSeconds, data.expiresAt.nanoseconds);
      }
      tx.update(itemRef, updates);
    });
  };

  const onDeletePublicItem = async () => {
    if (!detailItem) return;
    try {
      await deleteDoc(doc(db, 'public_items', detailItem.id));
      setDetailItem(null);
    } catch (e: any) { Alert.alert('Error deleting item', e.message); }
  };

  const onDeletePin = async () => {
    if (!detailPin) return;
    try {
      await deleteDoc(doc(db, 'pins', detailPin.id));
      setDetailPin(null);
    } catch (e: any) { Alert.alert('Error deleting pin', e.message); }
  };

  const onPromotePin = () => {
    if (!detailPin) return;
    setNewPublicItemText(detailPin.text);
    setPromotionCoords({ lat: detailPin.lat, lng: detailPin.lng });
    setDetailPin(null);
    setPromoteChoiceModalOpen(true);
  };

  const handlePromoteChoice = (type: 'shout' | 'spot') => {
    setNewPublicItemType(type);
    setPromoteChoiceModalOpen(false);
    setCreatePublicItemModalOpen(true);
  };

  const screenHeight = Dimensions.get('window').height;
  const toggleContainerHeight = 48 + 1 + 48 + 1 + 48; // Three buttons, two separators
  const verticalCenterOffset = (screenHeight / 2) - (toggleContainerHeight / 2) - 60; // Adjust position up
  

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <StatusBar barStyle="dark-content" />
      {mapCenter && (
        Platform.OS === 'web' ? (
          <WebMapView html={mapHtml} onMessage={onWebMessage} jsToInject={jsToInject} />
        ) : (
          <WebView ref={wv} source={{ html: mapHtml }} originWhitelist={['*']} onLoadEnd={() => setReady(true)} onMessage={onWebMessage} style={styles.webview} />
        )
      )}
      
      <View style={[styles.searchBar, { top: insets.top + 8 }]}>
        <TextInput style={styles.searchInput} placeholder="Search location" value={searchQuery} onChangeText={setSearchQuery} returnKeyType="search" onSubmitEditing={onSearch} />
        <TouchableOpacity style={styles.searchButton} onPress={onSearch}><Text style={styles.searchButtonText}>GO</Text></TouchableOpacity>
      </View>
      
      <TouchableOpacity 
        style={[styles.locateButton, { top: verticalCenterOffset + toggleContainerHeight + 16 }]} 
        onPress={locateMe}
      >
        <MaterialIcons name="my-location" size={24} color="#333" />
      </TouchableOpacity>

      <View style={[styles.layerToggleContainer, { top: verticalCenterOffset }]}>
        <TouchableOpacity style={[styles.layerToggleButton, mapMode === 'public' && styles.layerToggleButtonActive]} onPress={() => setMapMode('public')}>
          <MaterialCommunityIcons name="earth" size={24} color={mapMode === 'public' ? '#FFF' : '#333'} />
        </TouchableOpacity>
        <View style={styles.layerToggleSeparator} />
        <TouchableOpacity style={[styles.layerToggleButton, mapMode === 'pins' && styles.layerToggleButtonActive]} onPress={() => setMapMode('pins')}>
          <MaterialCommunityIcons name="map-marker" size={24} color={mapMode === 'pins' ? '#FFF' : '#333'} />
        </TouchableOpacity>
        {/* --- ADDED --- New AR Button */}
        <View style={styles.layerToggleSeparator} />
        <TouchableOpacity style={styles.layerToggleButton} onPress={launchAR}>
          <MaterialCommunityIcons name="camera-outline" size={24} color={'#333'} />
        </TouchableOpacity>
      </View>


      {/* NEW: Filter Pills UI */}
      {mapMode === 'pins' && (
        <View style={[styles.filterContainer, { bottom: (insets.bottom || 8) + 80 }]}>
          <FlatList
            data={filterPills}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item }) => {
              const isActive = activePinListFilter === item.id;
              return (
                <TouchableOpacity
                  style={[styles.filterPill, isActive && styles.filterPillActive]}
                  onPress={() => setActivePinListFilter(item.id)}
                >
                  <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                    {item.name}
                  </Text>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      )}

      <Modal visible={!!detailItem} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <TouchableOpacity onPress={() => setDetailItem(null)} style={styles.closeButton}><MaterialCommunityIcons name="close" size={24} /></TouchableOpacity>
            <View style={styles.header}><Text style={styles.modalTitle}>{detailItem?.authorName} {detailItem?.type === 'shout' ? 'shouted' : 'spotted'}</Text></View>
            <Text style={styles.message}>{detailItem?.text}</Text>
            <Text style={styles.expiresText}>Expires in {minutesLeft} minute{minutesLeft === 1 ? '' : 's'}</Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity onPress={onLikePress} disabled={isLiked} style={styles.actionButton}>
                <MaterialCommunityIcons name={isLiked ? 'heart' : 'heart-outline'} size={20} color={isLiked ? '#E53935' : '#333'} />
                <Text style={styles.actionLabel}>{isLiked ? 'Liked' : 'Like'}</Text>
              </TouchableOpacity>
              {isOwner && (
                <TouchableOpacity onPress={onDeletePublicItem} style={[styles.actionButton]}>
                  <MaterialCommunityIcons name="trash-can-outline" size={20} color="#E53935" />
                  <Text style={[styles.actionLabel, { color: '#E53935' }]}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={createPublicItemModalOpen} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <TouchableOpacity onPress={() => setCreatePublicItemModalOpen(false)} style={styles.closeButton}><MaterialCommunityIcons name="close" size={24} /></TouchableOpacity>
            <Text style={styles.modalTitle}>New Public {newPublicItemType === 'shout' ? 'Shout' : 'Spot'}</Text>
            <TextInput style={styles.messageInput} placeholder="What's new?" value={newPublicItemText} onChangeText={setNewPublicItemText} multiline />
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionButton} onPress={() => setCreatePublicItemModalOpen(false)}><Text style={styles.actionLabel}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.shoutButton]} onPress={onSubmitPublicItem}><Text style={[styles.actionLabel, { color: '#fff' }]}>Post</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={pinCreateModalOpen} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <TouchableOpacity onPress={() => { setPinCreateModalOpen(false); setNewPinText(''); setSelectedListIds([]); }} style={styles.closeButton}><MaterialCommunityIcons name="close" size={24} /></TouchableOpacity>
            <Text style={styles.modalTitle}>New Personal Pin</Text>
            <TextInput style={styles.messageInput} placeholder="Note, reminder, memory..." value={newPinText} onChangeText={setNewPinText} multiline />
            
            {/* NEW: List Selection UI */}
            <Text style={styles.listSelectionTitle}>Add to lists (optional)</Text>
            <View style={styles.listSelectionContainer}>
              {userPinLists.length > 0 ? (
                <FlatList
                    data={userPinLists}
                    keyExtractor={item => item.id}
                    renderItem={({item}) => {
                        const isSelected = selectedListIds.includes(item.id);
                        return (
                            <TouchableOpacity
                                style={[styles.listSelectItem, isSelected && styles.listSelectItemActive]}
                                onPress={() => handleListSelection(item.id)}
                            >
                                <Text style={[styles.listSelectItemText, isSelected && styles.listSelectItemTextActive]}>{item.name}</Text>
                            </TouchableOpacity>
                        )
                    }}
                />
              ) : (
                <Text style={styles.noListsText}>No lists created yet. Go to your profile to create one!</Text>
              )}
            </View>
            
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionButton} onPress={() => { setPinCreateModalOpen(false); setNewPinText(''); setSelectedListIds([]); }}><Text style={styles.actionLabel}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.actionButton, styles.shoutButton]} onPress={onSubmitPin}><Text style={[styles.actionLabel, { color: '#fff' }]}>Save Pin</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={!!detailPin} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <TouchableOpacity onPress={() => setDetailPin(null)} style={styles.closeButton}><MaterialCommunityIcons name="close" size={24} /></TouchableOpacity>
            <Text style={styles.modalTitle}>Personal Pin</Text>
            <Text style={styles.message}>{detailPin?.text}</Text>
            <View style={styles.actionsRow}>
              <TouchableOpacity onPress={onDeletePin} style={styles.actionButton}>
                <MaterialCommunityIcons name="trash-can-outline" size={20} color="#E53935" />
                <Text style={[styles.actionLabel, { color: '#E53935' }]}>Delete</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onPromotePin} style={[styles.actionButton, styles.shoutButton]}>
                <MaterialCommunityIcons name="bullhorn-outline" size={20} color="#fff" />
                <Text style={[styles.actionLabel, { color: '#fff' }]}>Share Publicly</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={promoteChoiceModalOpen} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            {/* ADDED: Close button */}
            <TouchableOpacity onPress={() => setPromoteChoiceModalOpen(false)} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>How to Share?</Text>
            <Text style={styles.message}>Share as a temporary Shout that expires, or a lasting Spot that gets renewed by community likes?</Text>
            <TouchableOpacity style={[styles.choiceButton, {backgroundColor: '#007AFF'}]} onPress={() => handlePromoteChoice('shout')}>
              <Text style={styles.choiceButtonText}>Shout (1 Hour)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.choiceButton, {backgroundColor: '#FFD600'}]} onPress={() => handlePromoteChoice('spot')}>
              <Text style={[styles.choiceButtonText, {color: '#000'}]}>Spot (Lasting)</Text>
            </TouchableOpacity>
            
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', },
  webview: { flex: 1, zIndex: -1 },
  backdrop: { ...StyleSheet.absoluteFillObject, flex: 1, backgroundColor:'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', },
  modalCard: { width: '90%', backgroundColor:'#FFF', borderRadius: 12, padding: 20, position: 'relative', },
  closeButton: { position: 'absolute', top: 12, right: 12, zIndex: 1, padding: 4,},
  header: { flexDirection: 'row', alignItems:  'center', marginBottom: 12, justifyContent: 'center' },
  modalTitle: { fontSize: 20, fontWeight: '600', marginBottom: 16, textAlign: 'center', paddingTop: 24,},
  message: { fontSize: 16, marginBottom: 24, color: '#333', textAlign: 'center', lineHeight: 22 },
  expiresText: { fontSize: 14, color: '#5B3EFC', marginBottom: 20, textAlign: 'center' },
  actionsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#EEE', borderRadius: 8, marginHorizontal: 4, },
  actionLabel: { marginLeft: 6, fontSize: 16, fontWeight: '500', color: '#333', },
  searchBar: { position: 'absolute', left: 16, right: 16, height: 44, flexDirection: 'row', backgroundColor: '#FFF', borderRadius: 22, overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 }, zIndex: 10, },
  searchInput: { flex: 1, paddingHorizontal: 16, fontSize: 16, backgroundColor: 'transparent', },
  searchButton: { width: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: '#007AFF', },
  searchButtonText: { color: '#FFF', fontWeight: '600', fontSize: 16, },
  messageInput: { borderWidth: 1, borderColor: '#DDD', borderRadius: 8, padding: 12, minHeight: 80, textAlignVertical: 'top', marginBottom: 16, },
  shoutButton: { backgroundColor: '#1976FF', },
  locateButton: { position: 'absolute', right: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowOffset: { width: 0, height: 2 }, shadowRadius: 3, zIndex: 10, },
  layerToggleContainer: { 
    position: 'absolute', 
    right: 16, 
    backgroundColor: '#fff', 
    borderRadius: 24, 
    elevation: 4, 
    shadowColor: '#000', 
    shadowOpacity: 0.2, 
    shadowOffset: { width: 0, height: 2 }, 
    shadowRadius: 3, 
    overflow: 'hidden', 
    flexDirection: 'column', 
  },
  layerToggleButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', },
  layerToggleButtonActive: { backgroundColor: '#007AFF', },
  layerToggleSeparator: { width: '80%', height: 1, backgroundColor: '#EEE', alignSelf: 'center', },
  choiceButton: { paddingVertical: 16, borderRadius: 12, alignItems: 'center', marginBottom: 8, width: '100%',},
  choiceButtonText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  listSelectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#666',
      marginBottom: 8,
    },
    listSelectionContainer: {
      maxHeight: 120, // Limit height to prevent modal from becoming too tall
      borderWidth: 1,
      borderColor: '#EEE',
      borderRadius: 8,
      marginBottom: 16,
    },
    listSelectItem: {
      padding: 12,
      borderBottomWidth: 1,
      borderBottomColor: '#EEE',
    },
    listSelectItemActive: {
      backgroundColor: '#E0EFFF',
    },
    listSelectItemText: {
      color: '#333',
    },
    listSelectItemTextActive: {
      fontWeight: 'bold',
      color: '#1976FF',
    },
    noListsText: {
      padding: 12,
      textAlign: 'center',
      color: '#999',
      fontStyle: 'italic',
    },
    // NEW STYLES for the filter pills
  filterContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 40,
    zIndex: 10,
  },
  filterPill: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 20,
    marginHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  filterPillActive: {
    backgroundColor: '#007AFF',
  },
  filterPillText: {
    color: '#000',
    fontWeight: '500',
  },
  filterPillTextActive: {
    color: '#FFF',
    fontWeight: 'bold',
  },
});