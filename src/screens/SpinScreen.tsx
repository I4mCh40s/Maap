// src/screens/SpinScreen.tsx
import React, { useRef, useState, useEffect } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native'
import { auth, db }               from '../firebase'
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
 // Import Alert at the top of your file
  import { /*...,*/ Alert } from 'react-native';

export default function SpinScreen() {
  // animation state
  const wheelAnim = useRef(new Animated.Value(0)).current
  const [prize, setPrize]     = useState<string | null>(null)

  // gating state
  const [loading,    setLoading]    = useState(true)
  const [canSpin,    setCanSpin]    = useState(false)
  const [nextSpinIn, setNextSpinIn] = useState(0) // milliseconds

  const segments = [
    'Spotlight',
    'Echo',
    'Megaphone',
    'Super Like',
    'Streak Bonus',
  ]

  // 1) on mount, load lastSpinAt and compute eligibility
  useEffect(() => {
    async function checkSpin() {
      setLoading(true)
      const user = auth.currentUser
      if (!user) {
        setCanSpin(false)
        setNextSpinIn(0)
        setLoading(false)
        return
      }

      const ref = doc(db, 'users', user.uid)
      const snap = await getDoc(ref)
      const data = snap.data() as any
      const lastTs = data?.lastSpinAt
      const now = Date.now()

      if (!lastTs) {
        // never spun before
        setCanSpin(true)
      } else {
        const lastMs = lastTs.toMillis()
        const delta = now - lastMs
        if (delta >= 24 * 60 * 60 * 1000) {
          setCanSpin(true)
        } else {
          setCanSpin(false)
          setNextSpinIn(24 * 60 * 60 * 1000 - delta)
        }
      }
      setLoading(false)
    }

    checkSpin()
  }, [])

  // helper to format remaining ms into "Hh Mm"
  const formatMs = (ms: number) => {
    const h = Math.floor(ms / 3600000)
    const m = Math.floor((ms % 3600000) / 60000)
    return `${h}h ${m}m`
  }

  
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

      // Add error handling for the database write
      try {
        // 2. Change updateDoc to setDoc with the merge option
        await setDoc(ref, {
          lastSpinAt: serverTimestamp(),
          powerUp: won,
        }, { merge: true }); // This will now create the document if it's missing
      } catch (error) {
        console.error("Failed to update user's spin data:", error);
        // If the database fails, roll back the UI changes to allow a retry.
        setCanSpin(true);
        setNextSpinIn(0);
        Alert.alert("Error", "Your spin could not be saved. Please check your connection and try again.");
      }
    });
  }

  // 3) wheel interpolation for rotation
  const spinInterpolation = wheelAnim.interpolate({
    inputRange: [0, 360],
    outputRange: ['0deg', '360deg'],
  })

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Daily Power-Up Spin</Text>

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
        <Text style={styles.cooldownText}>
          Next spin in {formatMs(nextSpinIn)}
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    justifyContent: 'center',
    alignItems:     'center',
    padding:        24,
    backgroundColor:'#fff',
  },
  title: {
    fontSize:   24,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  wheel: {
    width:   200,
    height:  200,
    borderRadius: 100,
    borderWidth:  4,
    borderColor:  '#ddd',
    justifyContent:'center',
    alignItems:   'center',
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
    color:      '#fff',
    fontSize:   16,
    fontWeight: 'bold',
  },
  cooldownText: {
    fontSize: 16,
    color: '#888',
  },
})
