// src/screens/MapScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
// locateMe libs
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';  // or whatever icon lib you use
//likes
import { updateDoc, increment } from 'firebase/firestore';
import { runTransaction, arrayUnion } from 'firebase/firestore';



import {
  SafeAreaView,
  View,
  Text,
  Modal,
  TextInput,
  Button,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Platform,
  StatusBar,
} from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';

import {
  collection,
  onSnapshot,
  addDoc,
  serverTimestamp,
  GeoPoint,
  deleteDoc,
  doc,               // ← import doc here
  Timestamp,
} from 'firebase/firestore';
import { db, auth } from '../firebase';

type Shout = {
  id: string;
  text: string;
  lat: number;
  lng: number;
  authorName: string;
  ownerId: string;       // ← added
  createdAt: number;     // millis since epoch
  likeCount: number;
  likedBy: string[];
  radius: number; 
};

export default function MapScreen({ route, navigation }: any) {
  // 0) Helper: compute distance in meters between two lat/lng pairs
  function getDistanceMeters(
    lat1: number, lon1: number,
    lat2: number, lon2: number
  ): number {
    const toRad = (v: number) => (v * Math.PI) / 180;
    const R = 6371000; // Earth radius (m)
    const φ1 = toRad(lat1), φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1), Δλ = toRad(lon2 - lon1);
    const a =
      Math.sin(Δφ/2) * Math.sin(Δφ/2) +
      Math.cos(φ1)*Math.cos(φ2) *
      Math.sin(Δλ/2)*Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // ─── your existing state hooks ────────────────────────────
  const wv = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>();
  const [address, setAddress] = useState('');
  const [shouts, setShouts] = useState<Shout[]>([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [text, setText] = useState('');
  const [detailShout, setDetailShout] = useState<Shout>();

  // 1) Auto-open modal if requested
  useEffect(() => {
  // grab our two boolean flags without clobbering your function names
  const { openShoutModal, shouldRecenter } = route.params || {};

  // 1) If the "+" button was tapped…
  if (openShoutModal) {
    setModalOpen(true);
    // clear so next tap can fire again
    navigation.setParams({ openShoutModal: false });
  }

  // 2) If the locate‐me button was tapped…
  if (shouldRecenter) {
    locateMe();  // ← your existing function that requests position & injects JS
    navigation.setParams({ shouldRecenter: false });
  }
  }, [route.params, navigation]);

  // 2) Get user location + reverse-geocode
  // runs just once, on component mount
useEffect(() => {
  (async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'This app needs location access.');
      return;
    }
    const pos = await Location.getCurrentPositionAsync({});
    setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    const [place] = await Location.reverseGeocodeAsync(pos.coords);
    setAddress([place.city, place.region].filter(Boolean).join(', '));
  })();
  }, []);


  // 3) Subscribe to shouts, include metadata, clean up >60 min
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, 'shouts'),
      { includeMetadataChanges: true },
      snap => {
        const now = Date.now();
        const valid: Shout[] = [];

        snap.docs.forEach(d => {
          const data = d.data() as any;
          const ts = (data.createdAt as Timestamp)?.toMillis() ?? now;

          if (now - ts > 60 * 60 * 1000) {
            deleteDoc(d.ref);
          } else {
            valid.push({
              id: d.id,
              text: data.text,
              lat: data.location.latitude,
              lng: data.location.longitude,
              authorName: data.authorName || 'Anonymous',
              ownerId: data.ownerId,           // ← capture ownerId here
              likeCount: data.likeCount || 0,   // ← grab it from Firestore
              likedBy: data.likedBy || [],
              radius:     data.radius     || 500,
              createdAt: ts,
            });
          }
        });

        setShouts(valid);
      }
    );

    return unsub;
  }, []);

  // 4) Push updated shouts into the WebView
  useEffect(() => {
    if (!ready || !coords) return;
    const { lat: userLat, lng: userLng } = coords;        // now guaranteed non-null
    
    // ➊ bounding‐box pre‐filter:
    const maybe = shouts.filter(s => {
    // 1° lat ≈ 111320 m
    const latDelta = s.radius / 111_320;
    // 1° lng ≈ 111320 m * cos(latitude)
    const lngDelta =
      s.radius / (111_320 * Math.cos(s.lat * Math.PI / 180));
    return (
      Math.abs(userLat - s.lat) <= latDelta &&
      Math.abs(userLng - s.lng) <= lngDelta
    );
 });

  // ➋ on that small set, do the precise check:
  const visible = maybe.filter(s =>
    getDistanceMeters(userLat, userLng, s.lat, s.lng) <= s.radius
  );

    const payload = JSON.stringify({
      type: 'shouts',
      data: visible.map(s => ({
      id:        s.id,
      text:      s.text,
      lat:       s.lat,
      lng:       s.lng,
      createdAt: s.createdAt
    })),
  });
    const jsToInject = `
      (function() {
        window.dispatchEvent(new MessageEvent('message', {
          data: ${JSON.stringify(payload)}
        }));
      })();
      true;
    `;
    wv.current?.injectJavaScript(jsToInject);
  }, [ready, shouts, coords]);

  // 5) Submit a new text shout
  async function onSubmit() {
    if (!text.trim()) {
      Alert.alert('Please enter a message');
      return;
    }
    if (!coords) return;

    await addDoc(collection(db, 'shouts'), {
      text: text.trim(),
      authorName: auth.currentUser?.displayName || 'Anonymous',
      ownerId: auth.currentUser?.uid,          // ← include ownerId on create
      location: new GeoPoint(coords.lat, coords.lng),
      createdAt: serverTimestamp(),
      likeCount: 0,
      likedBy: [] as string[],
      radius:     500,               // ← initial radius in meters
    });

    setText('');
    setModalOpen(false);
  }

  // 6) Handle marker-tap messages from WebView
  function onWebMessage(evt: any) {
    try {
      const msg = JSON.parse(evt.nativeEvent.data);
      if (msg.type === 'shoutTap') {
        const s = shouts.find(x => x.id === msg.id);
        if (s) setDetailShout(s);
      }
    } catch {}
  }

  // 7) Build the TomTom HTML
  const TOMTOM_KEY = 'zoyiO1lknbi8bagOcFtqev5TcihUwvbR';
  const html = `
<!DOCTYPE html><html><head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="initial-scale=1.0,user-scalable=no"/>
  <script src="https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.14.0/maps/maps-web.min.js"></script>
  <link href="https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.14.0/maps/maps.css" rel="stylesheet"/>
  <style>
    html,body,#map {margin:0;padding:0;width:100%;height:100%}
    .marker {width:20px;height:20px;border:2px solid #FFF;border-radius:50%;cursor:pointer;}
    .user-marker {width: 16px; height: 16px; background: rgba(0,150,136,0.8); border: 2px solid #FFF; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.3); transform: translate(-8px, -8px);}
  </style>
</head><body>
  <div id="map"></div>
  <script>
  const map = tt.map({
    key: '${TOMTOM_KEY}',
    container: 'map',
    center: [${coords?.lng}, ${coords?.lat}],
    zoom: 14
    
  });

  // 2) add “you are here” marker
  const userEl = document.createElement('div');
  userEl.className = 'user-marker';
  new tt.Marker({ element: userEl })
    .setLngLat([${coords?.lng}, ${coords?.lat}])
    .addTo(map);                              
  
  let markers = [];
  function clearMarkers() {
    markers.forEach(m => m.remove());
    markers = [];
  }

  function addMarkers(shouts) {
    clearMarkers();
    const now = Date.now();
    shouts.forEach(s => {
      const ageMs = now - s.createdAt;
      const leftMin = Math.max(0, Math.ceil((60 * 60 * 1000 - ageMs) / 60000));
      const color = leftMin <= 10 ? '#E53935' : '#5B3EFC';

      const el = document.createElement('div');
      el.className = 'marker';
      el.style.backgroundColor = color;
      el.onclick = () => {
        window.ReactNativeWebView.postMessage(
          JSON.stringify({ type: 'shoutTap', id: s.id })
        );
      };

      const m = new tt.Marker({ element: el })
        .setLngLat([s.lng, s.lat])
        .addTo(map);
      markers.push(m);
    });
  }

  // ← New unified handler for messages from React Native
  function handleMsg(e) {
    try {
      const msg = JSON.parse(e.data);
      if (msg.type === 'shouts') {
        addMarkers(msg.data);
      }
    } catch (err) {
      console.error('Failed to handle message', err);
    }
  }

  // Listen on both, so it works on iOS and Android WebView
  document.addEventListener('message', handleMsg);
  window.addEventListener('message', handleMsg);
</script>

</body></html>`;

  if (!coords) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  // ─── NEW: compute ownership ─────────────────────────────────────────────────
  const isOwner = detailShout?.ownerId === auth.currentUser?.uid;

  // ─── NEW: compute minutesLeft for countdown ──────────────────────────────────
  const minutesLeft = detailShout
    ? Math.max(
        0,
        Math.ceil((60 * 60 * 1000 - (Date.now() - detailShout.createdAt)) / 60000)
      )
    : 0;

  // locateMe button
  async function locateMe() {
  if (!coords) return;
  // just fetch a new one, no need to re-ask permission:
  const pos = await Location.getCurrentPositionAsync({});
  const { latitude, longitude } = pos.coords;
  setCoords({ lat: latitude, lng: longitude });

  // tell the WebView to recenter…
  const js = `
    map.setCenter([${longitude}, ${latitude}]);
    if (window.userMarker) window.userMarker.setLngLat([${longitude}, ${latitude}]);
    true;
  `;
  wv.current?.injectJavaScript(js);
  }

  // right before any JSX, e.g. above "return ("
  const currentUid = auth.currentUser?.uid ?? '';
  // If detailShout is set, check if this user has already liked it:
  const isLiked = !!detailShout && detailShout.likedBy.includes(currentUid);

  return (
    <SafeAreaView style={styles.container}>
      
      <WebView
        ref={wv}
        source={{ html }}
        originWhitelist={['*']}
        onLoadEnd={() => setReady(true)}
        onMessage={onWebMessage}
        style={styles.webview}
      />

      {/* Detail Modal */}
      <Modal visible={!!detailShout} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.detail}>
          <Text style={styles.detailTitle}>
            {detailShout?.authorName} shouted:
          </Text>
          <Text style={styles.detailText}>{detailShout?.text}</Text>
          <Text style={styles.countdown}>
            Expires in {minutesLeft} minute{minutesLeft === 1 ? '' : 's'}
          </Text>

            {/* ← Only render when detailShout exists AND current user is owner */}
            {detailShout && detailShout.ownerId === auth.currentUser?.uid && (
              <Button
                title="Delete Shout"
                color="#D32F2F"
                onPress={async () => {
                  try {
                    // Now detailShout is guaranteed non-null here
                    await deleteDoc(doc(db, 'shouts', detailShout.id));
                    setDetailShout(undefined);
                  } catch (e: any) {
                    Alert.alert('Error deleting shout', e.message);
                  }
                }}
              />
            )}
            <Text style={{ marginTop: 8, marginBottom: 4 }}>
              Likes: {detailShout?.likeCount ?? 0}
            </Text>
            <Button
              title={isLiked ? '👍 Liked' : '👍 Like'}
              onPress={async () => {
                if (!detailShout || isLiked) return;

                const shoutRef = doc(db, 'shouts', detailShout.id);
                await runTransaction(db, async tx => {
                  const snap = await tx.get(shoutRef);
                  if (!snap.exists()) throw new Error('Shout not found');
                  const data = snap.data() as any;

                  // Prevent double‐likes
                  const already = (data.likedBy as string[]) || [];
                  if (already.includes(auth.currentUser!.uid)) return;

                  // Compute new radius (100 m per like)
                  const currentRadius = (data.radius as number) || 500;
                  const newRadius     = currentRadius + 100;

                  tx.update(shoutRef, {
                    likedBy:    arrayUnion(auth.currentUser!.uid),
                    likeCount:  increment(1),
                    radius:     newRadius,
                  });
                });
              }}
              disabled={isLiked}
            />

            <Button title="Close" onPress={() => setDetailShout(undefined)} />
          </View>
        </View>
      </Modal>

      {/* Shout Modal */}
      <Modal visible={modalOpen} transparent animationType="slide">
        <View style={styles.overlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Your Shout</Text>
            <TextInput
              style={styles.input}
              placeholder="What's new?"
              value={text}
              onChangeText={setText}
            />
            <View style={styles.buttonsRow}>
              <Button title="Cancel" onPress={() => setModalOpen(false)} />
              <Button title="Shout!" onPress={onSubmit} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop:
      Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addressBar: {
    padding: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderColor: '#EEE',
  },
  webview: { flex: 1 },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 16,
  },
  detail: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 16,
  },
  detailTitle: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  detailText: {
    marginBottom: 8,
  },
  countdown: {
    marginBottom: 12,
    fontSize: 14,                    // a bit smaller
    color: 'rgba(0,0,0,0.5)',        // 60% opacity black
    // fontStyle: 'italic',          // (optional) give it an italic flair 
  },
  modal: {
    backgroundColor: '#FFF',
    borderRadius: 8,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    marginBottom: 12,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CCC',
    borderRadius: 8,
    padding: 8,
    marginBottom: 12,
    height: 80,
    textAlignVertical: 'top',
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  
});