// src/components/TopShoutsPanel.tsx
import React, { useEffect, useRef, useState, useMemo } from 'react';
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
import { MaterialCommunityIcons } from '@expo/vector-icons';

// 1. UNIFY THE SHOUT TYPE
// Use the same, more complete Shout type from MapScreen.tsx to ensure consistency.
// Note the change from `likes` to `likeCount`.
export interface Shout {
  id: string;
  text: string;
  lat: number;
  lng: number;
  likeCount: number; // Changed from `likes` to match MapScreen
  authorName?: string;
  authorIsMerchant?: boolean;
  authorIsVerified?: boolean;
  // Add any other fields from MapScreen's Shout type if needed
  // e.g., authorAvatar, ownerId, etc.
}

// 2. UPDATE THE PROPS INTERFACE
// We now accept `shouts` and remove `userCoords` and `radius`
// because the filtering is now done in the parent component.
interface Props {
  shouts: Shout[];
  top?: number;
  onSelectShout?: (shout: Shout) => void;
}

export default function TopShoutsPanel({
  shouts, // Receive the pre-filtered shouts
  top = 0,
  onSelectShout,
}: Props) {
  // 3. REMOVE UNNECESSARY STATE
  // We no longer need to store a separate pool or visible list.
  // const [shoutPool, setShoutPool] = useState<Shout[]>([]);
  // const [visibleShouts, setVisibleShouts] = useState<Shout[]>([]);
  
  const [expanded, setExpanded] = useState(false);
  const slide = useRef(new Animated.Value(0)).current;

  // 4. REMOVE ALL DATA FETCHING AND FILTERING LOGIC
  // The two `useEffect` hooks that fetched from Firestore and filtered by distance
  // have been completely removed.

  // 5. DERIVE TOP SHOUTS FROM PROPS USING useMemo
  // This is efficient. It only re-sorts when the `shouts` prop changes.
  const topVisibleShouts = useMemo(() => {
    return [...shouts]
      .filter(shout => shout.likeCount > 0)
      .sort((a, b) => b.likeCount - a.likeCount) // Sort by likeCount
      .slice(0, 5); // Take the top 5 of the visible shouts
  }, [shouts]);


  // Animation logic remains the same
  useEffect(() => {
    Animated.timing(slide, {
      toValue: expanded ? 1 : 0,
      duration: 250,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, [expanded, slide]);

  // This effect now watches our derived `topVisibleShouts`
  useEffect(() => {
    if (topVisibleShouts.length === 0) {
      setExpanded(false);
    }
  }, [topVisibleShouts]);

  const translateY = slide.interpolate({
    inputRange: [0, 1],
    outputRange: [-130, 0],
  });

  // The render guard is now much simpler
  if (topVisibleShouts.length === 0) {
    return null;
  }

  return (
    <View pointerEvents="box-none" style={[styles.container, { top }]}> 
      <TouchableOpacity
        activeOpacity={0.7}
        style={styles.handle}
        onPress={() => setExpanded(e => !e)}
      >
        <Text style={styles.handleText}>Top 🔥</Text>
      </TouchableOpacity>

      {expanded && (
        <Animated.FlatList
          style={[styles.listWrapper, { transform: [{ translateY }] }]}
          // Use the new derived array for the list data
          data={topVisibleShouts}
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
              <View style={styles.headerRow}>
                {/* This assumes authorAvatar is part of your unified Shout type */}
                {/* @ts-ignore */}
                {item.authorAvatar && (
                  // @ts-ignore
                  <Image source={{ uri: item.authorAvatar }} style={styles.avatar} />
                )}
                <Text style={styles.username} numberOfLines={1}>
                  {item.authorName}
                </Text>
                {item.authorIsMerchant ? (
                  <MaterialCommunityIcons name="storefront" size={18} color="#FF7043" style={styles.iconOffset} />
                ) : item.authorIsVerified ? (
                  <MaterialCommunityIcons name="check-decagram" size={18} color="#3BAEFC" style={styles.iconOffset} />
                ) : null}
              </View>

              <Text style={styles.text} numberOfLines={2}>
                {item.text}
              </Text>

              {/* Use likeCount here */}
              <Text style={styles.likes}>❤️ {item.likeCount}</Text>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

// Styles remain the same
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    paddingTop: 8,
    zIndex: 10, // Ensure it's above the map
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  username: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  iconOffset: {
    marginLeft: 4,
    transform: [{ translateY: 1 }],
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
  listWrapper: {},
});