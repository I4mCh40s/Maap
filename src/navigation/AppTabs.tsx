// src/navigation/AppTabs.tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import theme from '../theme';

import MapScreen from '../screens/MapScreen';
import ProfileScreen from '../screens/ProfileScreen';

type TabParamList = {
  Map: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

function CustomTabBar({ state, navigation }: any) {
  const isMapActive = state.index === 0;
  const isProfileActive = state.index === 1;

  return (
    // The container that positions the tab bar
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
    </View>
  );
}

export default function AppTabs() {
  return (
    <Tab.Navigator
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
  tabBarContainer: {
    position: 'absolute',
    bottom: 25,
    left: 20, // Give some horizontal margin
    right: 20,
    height: 65,
    alignItems: 'center',
  },
  tabBarPill: {
    flexDirection: 'row',
    backgroundColor: theme.colors.darkGrey,
    width: '100%', // Take up the available width within the container margins
    maxWidth: 250, // Set a max width for larger screens
    height: '100%',
    borderRadius: 40,
    justifyContent: 'space-around', // Evenly space the two icons
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  tabButton: {
    flex: 1, // Allow each button to take up equal space
    alignItems: 'center',
    justifyContent: 'center',
  },
  // The 'plusButton' style is no longer needed and has been removed.
});