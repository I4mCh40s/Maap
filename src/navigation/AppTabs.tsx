// src/navigation/AppTabs.tsx
import React from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import {
    SafeAreaView,
} from 'react-native-safe-area-context';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';


import HomeScreen from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';

type TabParamList = {
  Home: undefined;
  Add: { openShoutModal?: boolean };
  Profile: undefined;
};
type IconName = React.ComponentProps<
  typeof MaterialCommunityIcons
>['name'];
const Tab = createBottomTabNavigator<TabParamList>();

export default function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false }}
      tabBar={props => <MyTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Add" component={HomeScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function MyTabBar({ state, navigation }) {
  return (
    // SafeAreaView will automatically handle the bottom padding.
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      {/* The redundant paddingBottom style has been removed from this View. */}
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

          // special “+” pill
          if (route.name === 'Add') {
            return (
              <TouchableOpacity
                key={route.key}
                onPress={onPress}
                activeOpacity={0.8}
                style={styles.plusTouch}
              >
                <View style={styles.plusCircle}>
                  <MaterialCommunityIcons
                    name="plus"
                    size={32}
                    color="#fff"
                  />
                </View>
              </TouchableOpacity>
            );
          }

          // normal icons
          const iconName: IconName = route.name === 'Home' ? 'home' : 'account';
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              style={styles.tabButton}
            >
              <MaterialCommunityIcons
                name={iconName}
                size={24}
                color={focused ? '#fff' : '#888'}
              />
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    paddingTop: 8,
    alignItems: 'center',
    justifyContent: 'space-around',
    // Setting a minHeight ensures the bar is tall enough for the icons,
    // especially the raised "Add" button's negative margin.
    minHeight: 56, 
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
  },
  plusContainer: { // Note: This style is defined but not used in your component.
    position: 'absolute',
    alignSelf: 'center',
    width: 80,
    height: 80,
  },
  plusButton: { // Note: This style is defined but not used in your component.
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  safeArea: {
    backgroundColor: '#2196F3', // Tab bar color
  },
  bar: { // Note: This style is defined but not used in your component.
    flexDirection: 'row',
    backgroundColor: '#2196F3',
    justifyContent: 'space-around',
    alignItems: 'center',
    minHeight: 56, // Standard Android bottom-nav height
  },
  plusTouch: {
    // The "Add" button is absolutely positioned relative to its parent container.
    // By placing it in the middle of the map, it won't take up space in the layout.
    // We lift it up to be centered vertically over the tab bar's edge.
    position: 'absolute',
    left: '50%',
    transform: [{ translateX: -28 }], // Half of the circle's width
    top: -28, // Half of the circle's height
  },
  plusCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#2196F3',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});