// src/navigation/AppTabs.tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import theme from '../theme';

import MapScreen from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';

type TabParamList = {
  Map: { openCreateModal?: boolean };
  // We only need two "real" tabs. The plus button is a separate UI element.
  Profile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

// This is our fully custom tab bar component, inspired by your original code.
function CustomTabBar({ state, navigation }: any) {
  // `state.index` tells us which tab is active. 0 for Map, 1 for Profile.
  const isMapActive = state.index === 0;
  const isProfileActive = state.index === 1;

  return (
    // This is the main container that holds the pill and the plus button
    <View style={styles.tabBarContainer}>

      {/* The floating dark grey pill */}
      <View style={styles.tabBarPill}>
        {/* Map Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Map')}
          style={styles.tabButton}
        >
          <MaterialCommunityIcons
            name={isMapActive ? 'map' : 'map-outline'}
            color={isMapActive ? theme.colors.white : theme.colors.lightGrey}
            size={28}
          />
        </TouchableOpacity>

        {/* This empty View creates the space for the plus button */}
        <View style={{ width: 60 }} /> 

        {/* Profile Button */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          style={styles.tabButton}
        >
          <MaterialCommunityIcons
            name={isProfileActive ? 'account-circle' : 'account-circle-outline'}
            color={isProfileActive ? theme.colors.white : theme.colors.lightGrey}
            size={28}
          />
        </TouchableOpacity>
      </View>

      {/* The floating plus button, sits on top */}
      <TouchableOpacity
        style={styles.plusButton}
        onPress={() => navigation.navigate('Map', { openCreateModal: true })}
      >
        <MaterialCommunityIcons name="plus" size={28} color={theme.colors.black} />
      </TouchableOpacity>
    </View>
  );
}

export default function AppTabs() {
  return (
    <Tab.Navigator
      // We pass our custom component to the `tabBar` prop
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Map" component={MapScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  // The main container for positioning
  tabBarContainer: {
    position: 'absolute',
    bottom: 25,
    left: 0,
    right: 0,
    height: 65,
    alignItems: 'center', // Centers the pill and plus button horizontally
  },
  // The dark grey floating pill
  tabBarPill: {
    flexDirection: 'row',
    backgroundColor: theme.colors.darkGrey,
    width: 240, // Fixed width
    height: '100%',
    borderRadius: 40,
    justifyContent: 'space-between', // Pushes Map and Profile to the ends
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md, // Gives space at the ends
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  // The touchable area for Map and Profile icons
  tabButton: {
    // We don't need flex:1 anymore, the icon itself will be centered
  },
  // The floating "+" button
  plusButton: {
    // Sits on top of the pill in the absolute center of the container
    position: 'absolute',
    bottom: 7,
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: theme.colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});