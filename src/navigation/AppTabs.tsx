// src/navigation/AppTabs.tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView, useSafeAreaInsets }   from 'react-native-safe-area-context';
import { createBottomTabNavigator }           from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator }         from '@react-navigation/native-stack';
import { MaterialCommunityIcons }             from '@expo/vector-icons';

import MapScreen      from '../screens/MapScreen';
import SpinScreen     from '../screens/SpinScreen';
import ProfileScreen  from '../screens/ProfileScreen';

type TabParamList = {
  Home: {     // now Home can accept a nested navigation instruction
    screen?: 'Map';
    params?: { openShoutModal?: boolean };
  };
  Add: undefined;
  Profile: undefined;
};

const Tab       = createBottomTabNavigator<TabParamList>();
const HomeStack = createNativeStackNavigator();

function HomeStackScreen() {
  return (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
      <HomeStack.Screen 
        name="Map" 
        component={MapScreen} 
        initialParams={{ openShoutModal: false }}
      />
      <HomeStack.Screen 
        name="PowerUp" 
        component={SpinScreen} 
        options={{ presentation: 'modal' }}
      />
    </HomeStack.Navigator>
  );
}

export default function AppTabs() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#2196F3',
          borderTopWidth: 0,
          paddingBottom: insets.bottom,
          height:        56 + insets.bottom,
        },
        tabBarActiveTintColor:   '#fff',
        tabBarInactiveTintColor: '#888',
      }}
    >
      {/* Home Tab */}
      <Tab.Screen
        name="Home"
        component={HomeStackScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="home" size={24} color={color} />
          ),
        }}
      />

      {/* Add Tab: same stack, but will trigger the modal via params */}
      <Tab.Screen
        name="Add"
        component={HomeStackScreen}
        listeners={({ navigation }) => ({
          tabPress: e => {
            // Prevent default behavior
            e.preventDefault();
            // Navigate into the HomeStack, open the shout modal
            navigation.navigate('Home', { screen: 'Map', params: { openShoutModal: true } });
          },
        })}
        options={{
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="plus-circle" size={32} color={color} />
          ),
        }}
      />

      {/* Profile Tab */}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarIcon: ({ color }) => (
            <MaterialCommunityIcons name="account" size={24} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
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