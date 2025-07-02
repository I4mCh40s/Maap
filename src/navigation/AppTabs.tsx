// src/navigation/AppTabs.tsx
// src/navigation/AppTabs.tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { MaterialCommunityIcons } from '@expo/vector-icons';

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
      tabBar={props => <MyTabBar {...props} />}
    >
    
    {/* <Tab.Navigator 
    //   screenOptions={{ headerShown: false }}
    //   tabBar={props => (
    //     // wrap the bar in a View that adds a little bottom‐padding on Android
    //     <View
    //       style={{
    //         paddingBottom: Platform.OS === 'android' ? 24 : 0,
    //         // if MyTabBar has its own background, you don't need this;
    //         // otherwise uncomment to give it the same color:
    //         // backgroundColor: '#012A38',
    //       }}
    //     >
    //       <MyTabBar {...props} />
    //     </View>
    //   )}
    // >
    {/* delete up */}
      <Tab.Screen name="Home" component={MapScreen}  />
      <Tab.Screen name="Add"  component={MapScreen}   />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function MyTabBar({ state, navigation }) {
  return (
    <View style={styles.tabBar}>
      {state.routes.map((route, idx) => {
        const focused = state.index === idx;
        const onPress = () => {
          if (route.name === 'Add') {
            navigation.navigate('Add', { openShoutModal: true });
          } else {
            navigation.navigate(route.name);
          }
        };

        let iconName: string;
        if (route.name === 'Home')    iconName = 'home';
        else if (route.name === 'Profile') iconName = 'account';
        else iconName = 'plus';

        // for the plus, we want the big pill
        if (route.name === 'Add') {
          return (
            <TouchableOpacity key={route.key} onPress={onPress} style={styles.plusContainer}>
              <View style={styles.plusButton}>
                <MaterialCommunityIcons name="plus" size={32} color="#fff" />
              </View>
            </TouchableOpacity>
          );
        }

        // normal icons
        return (
          <TouchableOpacity key={route.key} onPress={onPress} style={styles.tabButton}>
            <MaterialCommunityIcons
              name={iconName as any}
              size={24}
              color={focused ? '#fff' : '#ccc'}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}


const styles = StyleSheet.create({
  tabBar: {
    flexDirection:  'row',
    backgroundColor: '#2196F3',    // <-- match Android Button blue
    height:          60,
    paddingTop:      8,
    paddingBottom:   8,
    alignItems:      'center',
    justifyContent:  'space-around',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
  },
  plusContainer: {
    position:  'absolute',
    bottom:    0,
    left:      '50%',
    marginLeft: -40,
    width:     80,
    alignItems: 'center',
  },
  plusButton: {
    width:            80,
    height:           80,
    borderRadius:     40,
    backgroundColor:  '#2196F3',
    alignItems:       'center',
    justifyContent:   'center',
    marginTop:       -30,
    elevation:        4,
    shadowColor:     '#000',
    shadowOpacity:   0.3,
    shadowOffset:    { width: 0, height: 2 },
    shadowRadius:    4,
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

