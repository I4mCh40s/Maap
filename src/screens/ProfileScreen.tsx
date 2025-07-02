// src/screens/ProfileScreen.tsx
import React, { useEffect, useState } from 'react'
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  FlatList,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { MaterialCommunityIcons } from '@expo/vector-icons'
import { signOut } from 'firebase/auth'
import { auth, db } from '../firebase'
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  doc,
  deleteDoc,
  Timestamp,
} from 'firebase/firestore'

type ShoutItem = {
  id:        string
  text:      string
  createdAt: Timestamp | null
  likeCount: number
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets()
  const user   = auth.currentUser
  const uid    = user?.uid

  const [shouts,     setShouts]    = useState<ShoutItem[]>([])
  const [loading,    setLoading]   = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // show any fetch errors once, then clear
  useEffect(() => {
    if (fetchError) {
      Alert.alert('Error', fetchError)
      setFetchError(null)
    }
  }, [fetchError])

  // real-time listener for *your* shouts
  useEffect(() => {
    if (!uid) {
      setLoading(false)
      setShouts([])
      return
    }
    const q = query(
      collection(db, 'shouts'),
      where('ownerId', '==', uid),
      orderBy('createdAt', 'desc')
    )
    const unsub = onSnapshot(
      q,
      snap => {
        const items = snap.docs.map(d => ({
          id:        d.id,
          text:      d.data().text as string,
          createdAt: (d.data().createdAt as Timestamp) || null,
          likeCount: (d.data().likeCount as number) || 0,
        }))
        setShouts(items)
        setLoading(false)
      },
      err => {
        console.error(err)
        setFetchError('Could not load your shouts')
        setLoading(false)
      }
    )
    return unsub
  }, [uid])

  async function handleLogout() {
    try {
      await signOut(auth)
    } catch (e: any) {
      Alert.alert('Logout failed', e.message)
    }
  }

  function renderShout({ item }: { item: ShoutItem }) {
    // safely format the date
    let dateStr = ''
    if (item.createdAt instanceof Timestamp) {
      dateStr = item.createdAt.toDate().toLocaleString()
    }
    // 2️⃣ compute minutes until 60-minute TTL
    let minutesLeft = 0
    if (item.createdAt instanceof Timestamp) {
      const ageMs      = Date.now() - item.createdAt.toMillis()
      const remaining  = 60*60*1000 - ageMs
      minutesLeft      = remaining > 0
        ? Math.ceil(remaining/60000)
        : 0
    }

    return (
      <View style={styles.card}>
        <Text style={styles.cardText}>{item.text}</Text>
        <View style={styles.cardMeta}>
          <Text style={styles.cardDate}>{dateStr}</Text>
          <Text style={styles.cardExpiry}>Expires in {minutesLeft} min</Text>
        </View>
        <View style={styles.cardFooter}>
          
          <Text style={styles.cardLikes}>❤️ {item.likeCount}</Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={async () => {
              try {
                await deleteDoc(doc(db, 'shouts', item.id))
              } catch (e: any) {
                Alert.alert('Delete failed', e.message)
              }
            }}
          >
            <MaterialCommunityIcons
              name="trash-can-outline"
              size={20}
              color="#E53935"
            />
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <SafeAreaView
      style={[styles.safe, { paddingTop: insets.top + 12 }]}
    >
      <View style={styles.container}>
        {/* HEADER */}
        <Text style={styles.title}>Your Profile</Text>

        {/* USER INFO */}
        <View style={styles.infoRow}>
          <Text style={styles.label}>Name:</Text>
          <Text style={styles.value}>{user?.displayName ?? '–'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Email:</Text>
          <Text style={styles.value}>{user?.email}</Text>
        </View>

        {/* LOG OUT BUTTON */}
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
        >
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        {/* YOUR SHOUTS SECTION */}
        <Text style={styles.sectionTitle}>Your Shouts</Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            style={{ marginTop: 16 }}
          />
        ) : shouts.length === 0 ? (
          <Text style={styles.noShouts}>
            You haven’t posted any shouts yet.
          </Text>
        ) : (
          <FlatList
            data={shouts}
            renderItem={renderShout}
            keyExtractor={s => s.id}
            contentContainerStyle={{ paddingBottom: 32 }}
          />
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex:            1,
    backgroundColor: '#F2F5F8',
  },
  container: {
    paddingHorizontal: 16,
    paddingBottom:     32,
  },
  title: {
    fontSize:     28,
    fontWeight:   '700',
    marginBottom: 24,
    textAlign:    'center',
    color:        '#333',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom:  12,
    alignItems:    'baseline',
  },
  label: {
    fontSize:    16,
    fontWeight:  '600',
    width:       80,
    color:       '#555',
  },
  value: {
    fontSize: 16,
    flex:     1,
    color:    '#111',
  },
  logoutButton: {
    marginTop:       24,
    marginBottom:    32,
    backgroundColor: '#E53935',
    paddingVertical: 12,
    borderRadius:    8,
    alignItems:      'center',
  },
  logoutText: {
    color:      '#FFF',
    fontSize:   16,
    fontWeight: '600',
  },
  sectionTitle: {
    fontSize:     22,
    fontWeight:   '600',
    marginBottom: 12,
    color:        '#333',
  },
  noShouts: {
    fontSize:   16,
    color:      '#777',
    textAlign:  'center',
    marginTop:  16,
  },
  card: {
    backgroundColor: '#FFF',
    borderRadius:    8,
    padding:         16,
    marginBottom:    12,
    shadowColor:     '#000',
    shadowOpacity:   0.05,
    shadowOffset:    { width: 0, height: 2 },
    shadowRadius:    4,
    elevation:       2,
  },
  cardText: {
    fontSize:    16,
    marginBottom: 8,
    color:       '#222',
  },
  cardFooter: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'space-between',
  },
  cardDate: {
    color:    '#666',
    fontSize: 12,
  },
  cardLikes: {
    marginHorizontal: 8,
    fontSize:         14,
    color:            '#E53935',
  },
  deleteButton: {
    padding: 4,
  },
    cardMeta: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    marginBottom:   8,
  },
  cardExpiry: {
    color:     '#E53935',
    fontSize:  12,
    fontStyle: 'italic',
  },

})
