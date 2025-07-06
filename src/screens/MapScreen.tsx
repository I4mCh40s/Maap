// src/screens/MapScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  SafeAreaView,
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
  Button,
} from 'react-native';

import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { Ionicons, MaterialCommunityIcons, MaterialIcons } from '@expo/vector-icons';

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
} from 'firebase/firestore';
import { db, auth } from '../firebase';

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

type Shout = {
  id: string;
  text: string;
  lat: number;
  lng: number;
  authorName: string;
  ownerId: string;
  createdAt: number;
  likeCount: number;
  likedBy: string[];
  radius: number;
  spotlight?: boolean;
  powerUp?: PowerUpType; 
  echoExpiresAt?: number; 
  authorIsVerified: boolean;
};

// If you added "streakBonus" at Spin time, include it here:
type PowerUpType = 'Spotlight' | 'Echo' | 'Megaphone' | 'Super Like' | 'Streak Bonus' |null;

export default function MapScreen({ route, navigation }: any) {
  const GOAL_LIKES = 10;

  // 0) Helpers…
  const wv = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [userCoords, setUserCoords] = useState<{lat:number,lng:number}|null>(null);
  const [mapCenter, setMapCenter] = useState<{lat:number,lng:number}|null>(null);
  const [address, setAddress] = useState('');
  const [shouts, setShouts] = useState<Shout[]>([]);

  // text/shout‐creation state
  const [modalOpen, setModalOpen] = useState(false);
  const [text, setText] = useState('');

  // DETAIL modal state now explicitly Shout|null
  const [detailShout, setDetailShout] = useState<Shout|null>(null);

  //powerups
  // ← NEW: hold what the user currently has…
  const [userPowerUp, setUserPowerUp]       = useState<PowerUpType>(null);
  // ← NEW: which one they're choosing to spend right now
  const [spendPowerUp, setSpendPowerUp]     = useState<PowerUpType>(null);

  // search state
  const [searchQuery, setSearchQuery] = useState('');
  // … location-search center, power-up, etc …

  // 1a) Open Shout Modal effect
  useEffect(() => {
    if (route.params?.openShoutModal) {
      setModalOpen(true);
      navigation.setParams({ openShoutModal: false });
    }
  }, [route.params?.openShoutModal, navigation]);

  // 1b) Recenter effect
  useEffect(() => {
    if (route.params?.shouldRecenter) {
      locateMe();
      navigation.setParams({ shouldRecenter: false });
    }
  }, [route.params?.shouldRecenter, navigation]);

  // 2) initial user loc + reverse‐geocode
  useEffect(() => {
  let sub: Location.LocationSubscription | undefined;

  (async () => {
    // Already asked on mount, but safe to check again
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'This app needs location access.');
      return;
    }

    sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Highest,   // or Balanced for battery
        timeInterval: 5000,                    // 5 s between updates
        distanceInterval: 20,                  // or every 20 m
      },
      ({ coords }) => {
        const pos = { lat: coords.latitude, lng: coords.longitude };
      setUserCoords(pos);

      // 👇 only set once, so the map won’t keep jumping
      setMapCenter(prev => prev ?? pos);

      wv.current?.injectJavaScript(`
        if (window.userMarker) window.userMarker.setLngLat([${pos.lng}, ${pos.lat}]);
        true;
      `);
      }
    );
  })();

  // Clean up when screen unmounts
  return () => sub?.remove();
}, []);

  // 3) subscribe + TTL cleanup
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'shouts'), snap => {
      const now = Date.now();
      const valid: Shout[] = [];
      snap.docs.forEach(d => {
        const data = d.data() as any;
        const ts = (data.createdAt as Timestamp)?.toMillis() ?? now;
        const ttl = (data.powerUp === 'Echo')
        ? 2 * 60*60*1000    // Echo gives you two hours
        : 60*60*1000;       // everybody else 60 min
        if (now - ts > ttl) {
          deleteDoc(d.ref);
        } else {
          valid.push({
            id: d.id,
            text: data.text,
            lat: data.location.latitude,
            lng: data.location.longitude,
            authorName: data.authorName||'Anonymous',
            ownerId: data.ownerId,
            createdAt: ts,
            spotlight: data.spotlight || false,
            likeCount: data.likeCount||0,
            likedBy: data.likedBy||[],
            radius: data.radius||500,
            authorIsVerified: data.authorIsVerified ?? false,
          });
        }
      });
      setShouts(valid);
    });
    return unsub;
  }, []);

  // 4) send “visible” shouts to WebView
  useEffect(() => {
    if (!ready || !userCoords) return;
    const { lat: uLat, lng: uLng } = userCoords;

    // bounding‐box prefilter
    const maybe = shouts.filter(s => {
      const latDelta = s.radius / 111_320;
      const lngDelta = s.radius / (111_320 * Math.cos(uLat * Math.PI/180));
      return Math.abs(uLat - s.lat) <= latDelta
          && Math.abs(uLng - s.lng) <= lngDelta;
    });

    // exact circle check
    const visible = maybe.filter(s =>
      getDistanceMeters(uLat, uLng, s.lat, s.lng) <= s.radius
    );

    const payload = JSON.stringify({
      type: 'shouts',
      data: visible.map(s => ({
      id:        s.id,
      text:      s.text,
      lat:       s.lat,
      lng:       s.lng,
      createdAt: s.createdAt,
      likeCount: s.likeCount  || 0,
      radius:    s.radius,
      spotlight: s.spotlight,
    })),
  });
    const jsToInject = `
      (function() {
        window.dispatchEvent(new MessageEvent('message', {
          data: '${payload.replace(/'/g, "\\'")}'   // <-- just ONE stringify, wrapped in quotes
        }));
      })();
      true;
    `;
    wv.current?.injectJavaScript(jsToInject);
  }, [ready, shouts, userCoords]);

  // ← NEW: keep in sync with whatever Power-Up the backend thinks we have
  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsub = onSnapshot(
      doc(db, 'users', uid),
      snap => {
        if (snap.exists()) {
          const data = snap.data() as any;
          setUserPowerUp((data.powerUp as PowerUpType) || null);
        }
      },
      err => {
        console.error('⛔ could not load user powerUp', err);
      }
    );

    return unsub;
  }, []);
  //superlike 
  const onSuperLikePress = async () => {
  if (!detailShout || userPowerUp !== 'Super Like') return;

  const shoutRef = doc(db, 'shouts', detailShout.id);
  await runTransaction(db, async tx => {
    const snap = await tx.get(shoutRef);
    if (!snap.exists()) throw new Error('Shout not found');
    const data = snap.data() as any;

    // bump its radius by 1000m
    const currentR = data.radius || 500;
    tx.update(shoutRef, {
      radius: currentR + 1000
    });
  });

  // clear your Super Like
  await updateDoc(doc(db, 'users', auth.currentUser!.uid), {
    powerUp: null
  });

  // optimistically update UI
  setUserPowerUp(null);
  setDetailShout({
    ...detailShout,
    radius: detailShout.radius + 1000
  });
};


  // 5) Submit a new text shout
  async function onSubmit() {
  try {
    if (!text.trim()) {
      Alert.alert('Please enter a message');
      return;
    }

    // 1) Figure out the shout’s base radius
    let initialRadius = 500;
    if (spendPowerUp === 'Streak Bonus') {
      initialRadius = 600;
    } else if (spendPowerUp === 'Megaphone') {
      initialRadius = 750;
    }

    // 2) Clear the powerUp on the user doc (if any)
    const uid = auth.currentUser!.uid;
    if (spendPowerUp) {
      await updateDoc(doc(db, 'users', uid), { powerUp: null });
    }


    const userDoc = await getDoc(doc(db, 'users', uid));
    const isVerified = userDoc.data()?.isVerified ?? false;

    // 3) Build the shout payload
    const shoutPayload: any = {
      text:       text.trim(),
      authorName: auth.currentUser?.displayName || 'Anonymous',
      ownerId:    uid,
      location:   new GeoPoint(userCoords!.lat, userCoords!.lng),
      createdAt:  serverTimestamp(),
      radius:     initialRadius,
      powerUp:    spendPowerUp || null,
      spotlight:  spendPowerUp === 'Spotlight',
      authorIsVerified: isVerified,
    };

    // 4) Only add echoExpiresAt if they used the Echo
    if (spendPowerUp === 'Echo') {
      // double-hour lifespan
      shoutPayload.echoExpiresAt = Date.now() + 2 * 60 * 60 * 1000;
    }

    // 5) Write it
    await addDoc(collection(db, 'shouts'), shoutPayload);

    // 6) Reset UI
    setText('');
    setSpendPowerUp(null);
    setModalOpen(false);

  } catch (err: any) {
    console.error('⛔ onSubmit failed:', err);
    Alert.alert('Error creating shout', err.message);
  }
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
  function buildTomTomHtml(
  center: { lat: number; lng: number }
): string {
  return `
        <!DOCTYPE html><html><head>
          <meta charset="utf-8"/>
          <meta name="viewport" content="initial-scale=1.0,user-scalable=no"/>
          <script src="https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.14.0/maps/maps-web.min.js"></script>
          <link href="https://api.tomtom.com/maps-sdk-for-web/cdn/6.x/6.14.0/maps/maps.css" rel="stylesheet"/>
          <style>
            html,body,#map {margin:0;padding:0;width:100%;height:100%}
            .marker {width:20px;height:20px;background: #5B3EFC;border:2px solid #FFF;border-radius:50%;cursor:pointer;transform: translate(-50%, -50%);z-index: 2;}
            .user-marker {width: 16px; height: 16px; background: rgba(0,150,136,0.8); border: 2px solid #FFF; border-radius: 50%; box-shadow: 0 0 4px rgba(0,0,0,0.3); transform: translate(-50%, -50%);z-index: 1; }
          </style>
        </head><body>
          <div id="map"></div>
          <script>
          const map = tt.map({
            key: '${TOMTOM_KEY}',
            container: 'map',
            center: [${mapCenter?.lng}, ${mapCenter?.lat}],
            zoom: 14,
            style: "https://api.tomtom.com/style/2/custom/style/dG9tdG9tQEBAMzJSMkJDa1NmTGNvR2h3RzsO9cOMFdVDGI-DPwgg0BlM.json?key=${TOMTOM_KEY}" // <--- UPDATED LINE
          });

          // 2) add “you are here” marker
          const userEl = document.createElement('div');
          userEl.className = 'user-marker';
          window.userMarker = new tt.Marker({ element: userEl })
            .setLngLat([${mapCenter?.lng}, ${mapCenter?.lat}])
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
                const likes = s.likeCount || 0;
                const size  = 20 + Math.sqrt(likes) * 5;

                const el = document.createElement('div');
                el.className = 'marker';
                // NEW: if spotlight, give it a glow
                if (s.spotlight) {
                  el.style.boxShadow = '0 0 8px 4px rgba(91,62,252,0.5)';
                }
                // use string concatenation instead of
                el.style.width        = size + 'px';
                el.style.height       = size + 'px';
                el.style.borderRadius = (size/2) + 'px';
                el.style.transform    = 'translate(' + (-size/2) + 'px, ' + (-size/2) + 'px)';

                el.onclick = () => {
                  window.ReactNativeWebView.postMessage(
                    JSON.stringify({ type:'shoutTap', id: s.id })
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
  }

  // inside your component function
    const htmlRef = useRef<string | null>(null);

    if (!htmlRef.current && mapCenter) {
      htmlRef.current = buildTomTomHtml(mapCenter); // runs once
    }

    if (!htmlRef.current) {
      return <ActivityIndicator style={{ flex: 1 }} />;
    }

  if (!userCoords) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  // ─── NEW: compute ownership ─────────────────────────────────────────────────
  const isOwner = detailShout?.ownerId === auth.currentUser?.uid;

  // ─── NEW: compute minutesLeft for countdown ──────────────────────────────────
  const baseDuration = 60 * 60 * 1000;
  const duration = (detailShout?.powerUp === 'Echo')
  ? 2 * baseDuration   // double time for Echo
  : baseDuration;
  const minutesLeft = detailShout
  ? Math.max(0, Math.ceil((duration - (Date.now() - detailShout.createdAt)) / 60000))
  : 0;

  // locateMe button
  async function locateMe() {
  if (!userCoords) return;
  // just fetch a new one, no need to re-ask permission:
  const pos = await Location.getCurrentPositionAsync({});
  const { latitude, longitude } = pos.coords;
  setMapCenter({ lat: latitude, lng: longitude });

  // tell the WebView to recenter…
  const js = `
    map.setCenter([${longitude}, ${latitude}]);
    if (window.userMarker) window.userMarker.setLngLat([${longitude}, ${latitude}]);
    true;
  `;
  wv.current?.injectJavaScript(js);
  }

  // Search
  async function onSearch() {
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch(
        `https://api.tomtom.com/search/2/geocode/${encodeURIComponent(searchQuery)}.json?key=${TOMTOM_KEY}`
      );
      const json = await res.json();
      const pos  = json.results?.[0]?.position;
      if (pos) {
        // ➊ remember the new center
        setMapCenter({ lat: pos.lat, lng: pos.lon });
        // ➋ update your address bar to show the query
        setAddress(searchQuery);
        // ➌ inject JS so the WebView map recenters
        const recenterJS = `
          map.setCenter([${pos.lon}, ${pos.lat}]);
          true; 
        `;
        wv.current?.injectJavaScript(recenterJS);
      } else {
        Alert.alert('Not found', 'Could not locate that address.');
      }
    } catch (e: any) {
      Alert.alert('Search failed', e.message);
    }
  }


  // right before any JSX, e.g. above "return ("
  const currentUid = auth.currentUser?.uid ?? '';
  // If detailShout is set, check if this user has already liked it:
  const isLiked = !!detailShout && detailShout.likedBy.includes(currentUid);

  const onLikePress = async () => {
    if (!detailShout || isLiked) return;
    const r = doc(db,'shouts',detailShout.id);
    await runTransaction(db, async tx => {
      const snap = await tx.get(r);
      const data = snap.data() as any;
      if ((data.likedBy||[]).includes(currentUid)) return;
      tx.update(r, {
        likedBy:   arrayUnion(currentUid),
        likeCount: increment(1)
      });
    });
    // **optimistic update** so UI flips immediately:
    setDetailShout(d => d
      ? {...d, likeCount: d.likeCount+1, likedBy: [...d.likedBy,currentUid]}
      : d
    );
  };
  const onDeletePress = async () => {
    if (!detailShout) return;
    try {
      await deleteDoc(doc(db, 'shouts', detailShout.id));
      setDetailShout(null);
    } catch (e: any) {
      Alert.alert('Error deleting shout', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>

    {/* ─── Map / WebView ──────────────────────────────── */}
    <WebView
      ref={wv}
      source={{ html: htmlRef.current }}
      originWhitelist={['*']}
      onLoadEnd={() => setReady(true)}
      onMessage={onWebMessage}
      style={styles.webview}
    />
    {/* ─── Floating Search Pill ───────────────────────── */}
    <View style={styles.searchBar}>
      <TextInput
        style={styles.searchInput}
        placeholder="Search location"
        value={searchQuery}
        onChangeText={setSearchQuery}
        returnKeyType="search"
        onSubmitEditing={onSearch}
      />
      <TouchableOpacity style={styles.searchButton} onPress={onSearch}>
        <Text style={styles.searchButtonText}>GO</Text>
      </TouchableOpacity>
    </View>
    
    {/* ─── Locate-Me Button ────────────────────────── */}
      <TouchableOpacity
        style={styles.locateButton}
        onPress={locateMe}
      >
        <MaterialIcons name="my-location" size={24} color="#333" />
      </TouchableOpacity>

      {/* ─── Spin Button ────────────────────────── */}
      <TouchableOpacity
        onPress={() => navigation.navigate('PowerUp')}
        style={styles.spinButton}
      >
      <MaterialCommunityIcons
        name="dice-multiple"
        size={24}
        color="#fff"
      />
      </TouchableOpacity>

    

    {/* ─── Detail “Shout” Modal ───────────────────────── */}
    <Modal visible={!!detailShout} transparent animationType="fade">
      <View style={StyleSheet.absoluteFill}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* close “X” */}
          <TouchableOpacity
            onPress={() => setDetailShout(null)}
            style={styles.closeButton}
          >
            <MaterialCommunityIcons name="close" size={24} />
          </TouchableOpacity>

          {/* avatar + title row */}
          <View style={styles.header}>
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarText}>
                {detailShout?.authorName.charAt(0)}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={styles.modalTitle}>{detailShout?.authorName}</Text>
              {detailShout?.authorIsVerified && (
                <MaterialCommunityIcons
                  name="check-decagram"
                  size={18}
                  color="#3BAEFC"
                  style={{ marginLeft: 4, transform: [{ translateY: -6 }] }}
                />
              )}
              <Text style={styles.modalTitle}> shouted</Text>
            </View>
          </View>

          {/* the shout text */}
          <Text style={styles.message}>{detailShout?.text}</Text>

          {/* expires info */}
          <TouchableOpacity>
            <Text style={styles.expiresText}>
              Expires in {minutesLeft} minute{minutesLeft === 1 ? '' : 's'}
            </Text>
            
            {/* ─── mini progress bar ─────────────────── */}
            <View style={styles.progressContainer}>
              {/* background track */}
              <View style={styles.progressBarBackground}>
                {/* colored fill: width = (likes / GOAL) * 100% */}
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(
                        (detailShout?.likeCount ?? 0) / GOAL_LIKES * 100,
                        100
                      )}%`,
                    },
                  ]}
                />
              </View>

              {/* label on the right */}
              <Text style={styles.progressLabel}>
                {Math.min(detailShout?.likeCount ?? 0, GOAL_LIKES)}/{GOAL_LIKES} Likes
              </Text>
            </View>

          </TouchableOpacity>

          {/* actions: like / delete */}
          <View style={styles.actionsRow}>
            <TouchableOpacity
              onPress={onLikePress}
              disabled={isLiked}
              style={styles.actionButton}
            >
              <MaterialCommunityIcons
                name={isLiked ? 'heart' : 'heart-outline'}
                size={20}
                color={isLiked ? '#E53935' : '#333'}
              />
              <Text style={styles.actionLabel}>
                {isLiked ? 'Liked' : 'Like'}
              </Text>
            </TouchableOpacity>

            {isOwner && (
              <TouchableOpacity
                onPress={onDeletePress}
                style={[styles.actionButton, styles.deleteButton]}
              >
                <MaterialCommunityIcons
                  name="trash-can-outline"
                  size={20}
                  color="#E53935"
                />
                <Text style={[styles.actionLabel, { color: '#E53935' }]}>
                  Delete
                </Text>
              </TouchableOpacity>
            )}
          </View>
          {userPowerUp === 'Super Like' && detailShout?.ownerId !== auth.currentUser?.uid && (
          <Button
            title="🎉 Super Like!"
            color="#E53935"
            onPress={onSuperLikePress}
          />
        )}
        </View>
        </View>
      </View>
    </Modal>

    {/* ─── New Shout Modal ───────────────────────────── */}
    <Modal visible={modalOpen} transparent animationType="fade">
      <View style={StyleSheet.absoluteFill}>
      <View style={styles.backdrop}>
        <View style={styles.modalCard}>
          {/* Close “X” */}
          <TouchableOpacity
            onPress={() => setModalOpen(false)}
            style={styles.closeButton}
          >
            <MaterialCommunityIcons name="close" size={24} />
          </TouchableOpacity>

          <Text style={styles.modalTitle}>Your Shout</Text>

          <TextInput
            style={styles.messageInput}
            placeholder="What's new?"
            value={text}
            onChangeText={setText}
            multiline
          />
          {/* ← NEW: if user has a powerUp, offer to spend it */}
            {userPowerUp && !spendPowerUp && (
              <Text style={styles.powerUpLabel}>
                Power-Up: {userPowerUp}
              </Text>
            )}

            {/* ← NEW: confirmation of chosen powerUp */}
            {spendPowerUp && (
              <Text style={styles.chosenPowerUp}>
                Using power-up: {spendPowerUp}
              </Text>
            )}
          {/* Power-Up Row (Floating) - now INSIDE the modal, above actions */}
          <View style={styles.powerUpFloatingRow}>
    {(['Spotlight', 'Echo', 'Megaphone', 'Super Like', 'Streak Bonus'] as const).map((type) => {
      // Choose icon and color for each powerup
      let iconName: keyof typeof MaterialCommunityIcons.glyphMap;
      let color = '#B0B0B0'; // gray for disabled
      let isActive = userPowerUp === type;

      switch (type) {
        case 'Spotlight':
          iconName = 'spotlight-beam';
          color = isActive ? '#FFD600' : '#B0B0B0';
          break;
        case 'Echo':
          iconName = 'volume-high';
          color = isActive ? '#00B8D4' : '#B0B0B0';
          break;
        case 'Megaphone':
          iconName = 'bullhorn';
          color = isActive ? '#FF7043' : '#B0B0B0';
          break;
        case 'Super Like':
          iconName = 'heart-multiple';
          color = isActive ? '#E53935' : '#B0B0B0';
          break;
        case 'Streak Bonus':
          iconName = 'fire';
          color = isActive ? '#FF9100' : '#B0B0B0';
          break;
        default:
          iconName = 'help-circle-outline';
      }

      return (
        <TouchableOpacity
          key={type}
          style={styles.powerUpIconButton}
          disabled={!isActive}
          onPress={() => {
            if (isActive) setSpendPowerUp(type as PowerUpType);
          }}
        >
          <MaterialCommunityIcons
            name={iconName}
            size={32}
            color={color}
            style={!isActive && { opacity: 0.5 }}
          />
        </TouchableOpacity>
      );
    })}
  </View>

          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => setModalOpen(false)}
            >
              <Text style={styles.actionLabel}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.shoutButton]}
              onPress={onSubmit}
            >
              <Text style={[styles.actionLabel, { color: '#fff' }]}>
                Shout!
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
      </View>
    </Modal>
  </SafeAreaView>

  );
}

const barHeight = Platform.OS === 'android'
  ? (StatusBar.currentHeight ?? 0)
  : 0;

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0, },
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
  webview: {
    position: 'absolute',
    top:      0,
    bottom:   0,
    left:     0,
    right:    0,
    zIndex:   0,      // explicitly low
  },
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
  /* modalTitle: {
    fontSize: 18,
    marginBottom: 12,
  }, */
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
  /* searchBar: {
    flexDirection: 'row',
    padding: 8,
    backgroundColor: '#FFF',
    alignItems: 'center',
  }, */
  searchInput: {
    flex: 1,
    paddingHorizontal: 12,
    fontSize: 16,
    backgroundColor: 'transparent',
  },
  
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    flex:           1,
    backgroundColor:'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems:     'center',
  },
  modalCard: {
    width:          '90%',
    backgroundColor:'#FFF',
    borderRadius:   12,
    padding:        20,
    position:       'relative',  // so closeButton can be absolute
  },
  closeButton: {
    position: 'absolute',
    top:      12,
    right:    12,
    zIndex:   1,
  },
  header: {
    flexDirection: 'row',
    alignItems:  'center',
    marginBottom: 12,
  },
  avatarPlaceholder: {
    backgroundColor: '#EEE',
    width: 40, height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 18,
    color: '#555',
  },
  modalTitle: {
    fontSize:   20,
    fontWeight: '600',
    marginBottom: 16,
    textAlign:   'center',
  },
  message: {
    fontSize: 16,
    marginBottom: 12,
    color: '#333',
  },
  expiresText: {
    fontSize: 14,
    color: '#5B3EFC',
    marginBottom: 20,
  },
  actionsRow: {
    flexDirection:  'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',       // ← lay items out in a row
    alignItems: 'center',       // ← vertically center icon+text
    justifyContent: 'center',
    paddingVertical: 6,         // ← slim it down
    paddingHorizontal: 12,      // ← give some side padding
    backgroundColor: '#EEE',
    borderRadius: 6,
    marginHorizontal: 4,
  },
  actionLabel: {
    marginLeft: 6,              // ← space between icon & text
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  deleteButton: {
    marginLeft: 24,
  },
  searchBar: {
    position: 'absolute',
    top: Platform.OS === 'android'
      ? StatusBar.currentHeight! + 8
      : 8,
    left: 16,
    right: 16,
    height: 40,
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 8,
    overflow: 'hidden',
    elevation: 3,          // Android shadow
    shadowColor: '#000',   // iOS shadow
    shadowOpacity: 0.1,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 10,
  },
  topSafeArea: {
    backgroundColor: '#FFF',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  searchButton: {
    width: 50,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007AFF',
  },
  searchButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },
  messageInput: {
    borderWidth:   1,
    borderColor:   '#DDD',
    borderRadius:  8,
    padding:       12,
    minHeight:     80,
    textAlignVertical: 'top',
    marginBottom:  16,
  },
  shoutButton: {
    backgroundColor: '#1976FF', // same blue you use elsewhere
  },
  progressBarContainer: {
  width:          '100%',
  height:         6,
  backgroundColor:'#EEE',
  borderRadius:   3,
  overflow:       'hidden',
  marginVertical: 8,
},
progressBarFill: {
  height:         6,
  backgroundColor:'#5B3EFC',
},
progressLabel: {
  fontSize: 12,
  color:    '#555',
  textAlign:'right',
  marginBottom: 4,
},
progressContainer: {
    marginVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBarBackground: {
    flex: 1,
    height: 6,
    backgroundColor: '#EEE',
    borderRadius: 3,
    overflow: 'hidden',
    marginRight: 8,
  },
  locateButton: {
    position: 'absolute',
    bottom: 100,
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,            // Android shadow
    shadowColor: '#000',     // iOS shadow
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    zIndex: 10,
  },
    spinButton: {
    position:   'absolute',
    bottom:     100,     // just above your + button
    left:       16,
    
    width:      48,
    height:     48,
    borderRadius: 24,
    backgroundColor: '#181C2F',
    justifyContent:  'center',
    alignItems:     'center',
    elevation:      5,  // Android shadow
    shadowColor:   '#000',
    shadowOpacity: 0.25,
    shadowRadius:  4,
    shadowOffset:  { width: 0, height: 2 },
  },
  powerUpRow: {
    flexDirection: 'column',
    alignItems: 'stretch',
    marginBottom: 8,
    width: '100%',
  },
  powerUpButton: {
    alignSelf: 'stretch',
    marginTop: 6,
    marginBottom: 8,
  },
  powerUpLabel: {
    fontSize: 14,
    color: '#333',
  },
  chosenPowerUp: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  powerUpFloatingRow: {
    // REMOVE position, left, right, bottom, zIndex, marginHorizontal
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 12,
    marginBottom: 12, // add spacing above the action buttons
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 6,
  },
  powerUpIconButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
    opacity: 1,
  },
});