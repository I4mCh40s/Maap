// src/navigation/AppTabs.tsx
// src/navigation/AppTabs.tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/MapScreen';
import MapScreen from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';

type TabParamList = {
  Home: undefined;
  Add: { openShoutModal?: boolean };    // <— now Add can take that flag
  Profile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

export default function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={props => <MyCustomTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen
        name="Add"
        component={MapScreen}
        listeners={({ navigation }) => ({
          tabPress: e => {
            // prevent default behavior
            e.preventDefault();
            // re-use MapScreen but trigger the shout modal
            navigation.navigate('Add', { openShoutModal: true });
          },
        })}
      />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function MyCustomTabBar({ state, descriptors, navigation }: any) {
  return (
    <View style={styles.tabBar}>
      {state.routes.map((route: any, index: number) => {
        const isFocused = state.index === index;

        // Decide icon per route
        let iconName: React.ComponentProps<typeof Ionicons>['name'] = 'ellipse-outline';
        if (route.name === 'Home') iconName = 'home-outline';
        if (route.name === 'Add') iconName = 'add';
        if (route.name === 'Profile') iconName = 'person-outline';

        // Handler
        const onPress = () => {
          // default for Home/Profile
          if (route.name !== 'Add') {
            navigation.navigate(route.name);
          } else {
            // our custom Add handler lives in listeners above
            navigation.emit({
              type: 'tabPress',
              target: route.key,
            });
          }
        };

        // SPECIAL: center “Add” button
        if (route.name === 'Add') {
          return (
            <TouchableOpacity
              key="add"
              onPress={onPress}
              style={styles.addButtonContainer}
              activeOpacity={0.7}
            >
              <View style={styles.addButton}>
                <Ionicons name={iconName} size={28} color="#FFF" />
              </View>
            </TouchableOpacity>
          );
        }

        // HOME and PROFILE sit to left/right
        return (
          <TouchableOpacity
            key={route.name}
            onPress={onPress}
            style={styles.tabItem}
            activeOpacity={0.7}
          >
            <Ionicons
              name={iconName}
              size={24}
              color={isFocused ? '#FFF' : 'rgba(255,255,255,0.6)'}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    height: 60,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 40,
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
  },
  addButtonContainer: {
    position: 'absolute',
    top: -30,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  addButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    // shadow for iOS
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 4,
    // elevation for Android
    elevation: 5,
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

