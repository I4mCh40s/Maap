// src/screens/SpinScreen.tsx
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { auth, db } from '../firebase';
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from 'firebase/firestore';

export default function SpinScreen() {
  // animation state
  const wheelAnim = useRef(new Animated.Value(0)).current;
  const [prize, setPrize] = useState<string | null>(null);

  // gating state
  const [loading, setLoading] = useState(true);
  const [canSpin, setCanSpin] = useState(false);
  const [nextSpinIn, setNextSpinIn] = useState(0); // milliseconds

  const segments = [
    'Spotlight',
    'Echo',
    'Megaphone',
    'Super Like',
    'Streak Bonus',
  ];

  // Short description of each power‑up
  const powerUpInfo = [
    {
      name: 'Spotlight',
      desc: 'Your shout gets a special glow or icon for its full hour, making it stand out visually.',
    },
    {
      name: 'Echo',
      desc: 'Lifespan of your shout is doubled to two hours.',
    },
    {
      name: 'Megaphone',
      desc: 'The radius starts at 750m instead of 500m',
    },
    {
      name: 'Super Like',
      desc: "Boost someone else's radius by 1km",
    },
    {
      name: 'Streak Bonus',
      desc: 'Permanent start at 600m radius. Unlocked after 7 consecutive days of spinning.',
    },
  ];

  // 1) on mount, load lastSpinAt and compute eligibility
  useEffect(() => {
    async function checkSpin() {
      setLoading(true);
      const user = auth.currentUser;
      if (!user) {
        setCanSpin(false);
        setNextSpinIn(0);
        setLoading(false);
        return;
      }

      const ref = doc(db, 'users', user.uid);
      const snap = await getDoc(ref);
      const data = snap.data() as any;
      const lastTs = data?.lastSpinAt;
      const now = Date.now();

      if (!lastTs) {
        setCanSpin(true);
      } else {
        const lastMs = lastTs.toMillis();
        const delta = now - lastMs;
        if (delta >= 24 * 60 * 60 * 1000) {
          setCanSpin(true);
        } else {
          setCanSpin(false);
          setNextSpinIn(24 * 60 * 60 * 1000 - delta);
        }
      }
      setLoading(false);
    }

    checkSpin();
  }, []);

  // helper to format remaining ms into "Hh Mm"
  const formatMs = (ms: number) => {
    const h = Math.floor(ms / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    return `${h}h ${m}m`;
  };

  function doSpin() {
    if (!canSpin) return;

    // Set state for cooldown UI immediately
    setCanSpin(false);
    setNextSpinIn(24 * 60 * 60 * 1000);

    setPrize(null);
    const toValue = 360 * 10 + Math.random() * 360;
    Animated.timing(wheelAnim, {
      toValue,
      duration: 4000,
      useNativeDriver: true,
    }).start(async () => {
      const idx = Math.floor(Math.random() * segments.length);
      const won = segments[idx];
      setPrize(won);

      const user = auth.currentUser!;
      const ref = doc(db, 'users', user.uid);

      try {
        await setDoc(
          ref,
          {
            lastSpinAt: serverTimestamp(),
            powerUp: won,
          },
          { merge: true },
        );
      } catch (error) {
        console.error("Failed to update user's spin data:", error);
        // If the database fails, roll back the UI changes to allow a retry.
        setCanSpin(true);
        setNextSpinIn(0);
        Alert.alert('Error', 'Your spin could not be saved. Please check your connection and try again.');
      }
    });
  }

  // wheel interpolation for rotation
  const spinInterpolation = wheelAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Daily Power‑Up Spin</Text>

      <Animated.View
        style={[styles.wheel, { transform: [{ rotate: spinInterpolation }] }]}
      >
        <Text style={styles.wheelIcon}>🎡</Text>
      </Animated.View>

      {prize ? (
        <Text style={styles.prizeText}>You got: {prize}!</Text>
      ) : null}

      {canSpin ? (
        <TouchableOpacity
          style={[styles.button, { opacity: canSpin ? 1 : 0.5 }]}
          onPress={doSpin}
        >
          <Text style={styles.buttonText}>SPIN</Text>
        </TouchableOpacity>
      ) : (
        <>
          <Text style={styles.cooldownText}>
            Next spin in {formatMs(nextSpinIn)}
          </Text>

          {/* Power‑up descriptions */}
          <View style={styles.infoBox}>
            <Text style={styles.infoTitle}>Power‑ups</Text>
            {powerUpInfo.map(p => (
              <Text key={p.name} style={styles.infoItem}>
                <Text style={styles.infoName}>{p.name}: </Text>
                {p.desc}
              </Text>
            ))}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  wheel: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 4,
    borderColor: '#ddd',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  wheelIcon: {
    fontSize: 48,
  },
  prizeText: {
    fontSize: 18,
    marginBottom: 16,
    color: '#333',
  },
  button: {
    backgroundColor: '#5B3EFC',
    paddingVertical: 12,
    paddingHorizontal: 32,
    borderRadius: 8,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cooldownText: {
    fontSize: 16,
    color: '#888',
  },
  /* NEW STYLES */
  infoBox: {
    marginTop: 32,
    paddingHorizontal: 24,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  infoItem: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  infoName: {
    fontWeight: '600',
  },
});
