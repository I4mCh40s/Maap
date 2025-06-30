// src/navigation/AppTabs.tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons }                   from '@expo/vector-icons';
import { createBottomTabNavigator }   from '@react-navigation/bottom-tabs';
import HomeScreen    from '../screens/MapScreen';
import MapScreen     from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';
import * as Linking  from 'expo-linking';

const Tab = createBottomTabNavigator();

function LocateButton({ onPress }: { onPress(): void }) {
  return (
    <View style={styles.locateContainer}>
      <TouchableOpacity onPress={onPress} style={styles.locateButton}>
        <Ionicons name="navigate" size={24} color="#022B3A" />
      </TouchableOpacity>
    </View>
  );
}

export default function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={props => <MyCustomTabBar {...props} />}
    >
      <Tab.Screen name="Home"    component={HomeScreen}   />
      <Tab.Screen name="Add"     component={MapScreen}    />
      <Tab.Screen name="Profile" component={ProfileScreen}/>
    </Tab.Navigator>
  );
}

function MyCustomTabBar({ state, descriptors, navigation }: any) {
  // we’ll use the “Add” button to open the modal; locateMe below
  return (
    <>
      <LocateButton onPress={() => {
        // tell MapScreen to recenter
        navigation.navigate('Add', { shouldRecenter: true });
      }} />

      <View style={styles.tabBar}>
        {state.routes.map((route: any, idx: number) => {
          const isFocused = state.index === idx;

          let iconName: any = 'help';
          if (route.name === 'Home')    iconName = 'home';
          if (route.name === 'Add')     iconName = 'add';
          if (route.name === 'Profile') iconName = 'person';

          // bigger, lifted circle for Add
          const isAdd = route.name === 'Add';

          // intercept Add tab
          const onPress = () => {
            if (isAdd) {
              navigation.navigate('Add', { openShoutModal: true });
            } else {
              navigation.navigate(route.name);
            }
          };

          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={[styles.tabItem, isAdd && styles.addContainer]}
            >
              <Ionicons
                name={iconName}
                size={isAdd ? 36 : 24}
                color={isFocused ? '#fff' : '#ccc'}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection:  'row',
    height:         60,
    backgroundColor:'#022B3A',
    alignItems:     'center',
    justifyContent: 'space-around',
    paddingBottom:  Platform.OS === 'ios' ? 20 : 0,
  },
  tabItem: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
  },
  addContainer: {
    marginTop:       -12,
    backgroundColor: '#022B3A',
    width:           64,
    height:          64,
    borderRadius:    32,
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#fff',
    shadowOpacity:   0.1,
    shadowRadius:    6,
    shadowOffset:    { width:0, height:2 },
    elevation:       4,
  },

  locateContainer: {
    position:   'absolute',
    left:       16,
    bottom:     80,   // sits just above the tabBar
    zIndex:     10,
  },
  locateButton: {
    width:           48,
    height:          48,
    borderRadius:    24,
    backgroundColor: '#fff',
    alignItems:      'center',
    justifyContent:  'center',
    shadowColor:     '#000',
    shadowOpacity:   0.1,
    shadowRadius:    6,
    shadowOffset:    { width:0, height:2 },
    elevation:       4,
  },
});

// // src/navigation/AppTabs.tsx
// import React from 'react';
// import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
// import MapScreen     from '../screens/MapScreen';
// import ProfileScreen from '../screens/ProfileScreen';
// import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';

// const Tab = createBottomTabNavigator();

// export default function AppTabs() {
//   return (
//     <Tab.Navigator
//       screenOptions={{ headerShown: false }}
//       tabBar={(props) => <MyTabBar {...props} />}
//     >
//       <Tab.Screen name="Map"     component={MapScreen} />
//       <Tab.Screen name="Profile" component={ProfileScreen} />
//     </Tab.Navigator>
//   );
// }

// function MyTabBar({ state, descriptors, navigation }) {
//   return (
//     <View style={styles.tabBar}>
//       {/* Left icon: Map */}
//       <TouchableOpacity
//         style={styles.tab}
//         onPress={() => navigation.navigate('Map')}
//       >
//         <Text style={styles.icon}>🗺️</Text>
//       </TouchableOpacity>

//       {/* Center “＋” */}
//       <TouchableOpacity
//         style={styles.fab}
//         onPress={() => navigation
//           .navigate('Map', { openShoutModal: true })}
//       >
//         <Text style={styles.plus}>＋</Text>
//       </TouchableOpacity>

//       {/* Right icon: Profile */}
//       <TouchableOpacity
//         style={styles.tab}
//         onPress={() => navigation.navigate('Profile')}
//       >
//         <Text style={styles.icon}>👤</Text>
//       </TouchableOpacity>
//     </View>
//   );
// }

// const styles = StyleSheet.create({
//   tabBar: {
//     flexDirection: 'row',
//     height: 56,
//     backgroundColor: '#FFF',
//     elevation: 8,
//     alignItems: 'center',
//     justifyContent: 'space-around',
//   },
//   tab: {
//     flex: 1,
//     alignItems:'center',
//   },
//   icon: { fontSize: 24 },
//   fab: {
//     width: 60,
//     height: 60,
//     borderRadius: 30,
//     backgroundColor: '#5B3EFC',
//     alignItems:'center',
//     justifyContent:'center',
//     marginTop:-30,  // float above bar
//     elevation:4,
//   },
//   plus: { fontSize: 32, color:'#FFF', lineHeight:32 },
// });

