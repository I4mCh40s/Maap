// src/components/TopShoutsPanel.tsx
// Lightweight “Top Shouts nearby” overlay. Fetches the most‑liked shouts
// (likeCount > 0) within `radius` metres of the user.

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  Animated,
  Easing,
} from 'react-native';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';
import { db } from '../firebase';
import { distanceBetween } from 'geofire-common';

export interface Shout {
  id: string;
  text: string;
  likes: number; // client‑side prop – maps to likeCount in Firestore
  lat: number;
  lng: number;
  authorAvatar?: string;
}

interface Props {
  userCoords: { lat: number; lng: number } | null;
  top?: number; 
  radius?: number; // metres, default 500
  onSelectShout?: (shout: Shout) => void;
}

export default function TopShoutsPanel({
  userCoords,
  top = 0,
  radius = 500,
  onSelectShout,
}: Props) {
  const [visibleShouts, setVisibleShouts] = useState<Shout[]>([]);
  const [expanded, setExpanded] = useState(false);

  // slide animation 0 (collapsed) → 1 (expanded)
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: expanded ? 1 : 0,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [expanded, slide]);

  // ---------- Firestore listener ----------
  useEffect(() => {
    if (!userCoords) return;

    // We now query by **likeCount** (numeric field) instead of “likes”.
    // Add a small >0 filter so empty docs don’t come back.
    const topQ = query(
      collection(db, 'shouts'),
      where('likeCount', '>', 0),
      orderBy('likeCount', 'desc'),
      limit(20),
    );

    const unsub = onSnapshot(topQ, snap => {
      const pool: Shout[] = [];
      snap.forEach(doc => {
        const d = doc.data() as any;

        // accommodate both numeric fields and GeoPoint objects
        const lat: number | undefined =
          typeof d.lat === 'number' ? d.lat : d.location?.latitude;
        const lng: number | undefined =
          typeof d.lng === 'number' ? d.lng : d.location?.longitude;

        if (typeof lat !== 'number' || typeof lng !== 'number') {
          // skip malformed docs – prevents "Invalid GeoFire location" error
          return;
        }

        pool.push({
          id: doc.id,
          text: d.text || '',
          likes: d.likeCount || 0,
          lat,
          lng,
          authorAvatar: d.authorAvatar || undefined,
        });
      });

      const nearby = pool
        .filter(s =>
          distanceBetween(
            [userCoords.lat, userCoords.lng],
            [s.lat, s.lng],
          ) <= radius,
        )
        .slice(0, 5);

      setVisibleShouts(nearby);
(nearby);
    });

    return unsub;
  }, [userCoords, radius]);

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [-130, 0],
  });

  if (!userCoords || visibleShouts.length === 0) return null;

  return (
    <View pointerEvents="box-none" style={[styles.container, { top }]}>
      {/* always‑visible handle */}
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.handle}
        onPress={() => setExpanded(e => !e)}
      >
        <Text style={styles.handleText}>Top 🔥</Text>
      </TouchableOpacity>

      {/* sliding list – only mounted when expanded */}
        {expanded && (
        <Animated.FlatList
            style={[styles.listWrapper, { transform: [{ translateY }] }]}
            data={visibleShouts}
            keyExtractor={item => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
            <TouchableOpacity
                style={styles.card}
                activeOpacity={0.8}
                onPress={() => onSelectShout?.(item)}
            >
                {item.authorAvatar && (
                <Image source={{ uri: item.authorAvatar }} style={styles.avatar} />
                )}
                <Text style={styles.text} numberOfLines={2}>
                {item.text}
                </Text>
                <Text style={styles.likes}>❤️ {item.likes}</Text>
            </TouchableOpacity>
            )}
        />
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingTop: 8,

  },
  handle: {
    alignSelf: 'flex-start',
    marginLeft: 16,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 12,
  },
  handleText: {
    color: '#fff',
    fontWeight: '600',
  },
  listContent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  card: {
    width: 220,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 16,
    padding: 12,
    marginRight: 12,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginBottom: 8,
  },
  text: {
    color: '#fff',
    fontSize: 14,
    marginBottom: 6,
  },
  likes: {
    color: '#FFD54F',
    fontWeight: '700',
    fontSize: 12,
    alignSelf: 'flex-end',
  },
  listWrapper: {
  
},
});
