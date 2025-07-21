// src/navigation/AppTabs.tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets }   from 'react-native-safe-area-context';
import { createBottomTabNavigator }           from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator }         from '@react-navigation/native-stack';
import { MaterialCommunityIcons }             from '@expo/vector-icons';

import MapScreen      from '../screens/MapScreen';
import SpinScreen     from '../screens/SpinScreen';
import ProfileScreen  from '../screens/ProfileScreen';

type TabParamList = {
  Home: {
    screen?: 'Map';
    params?: { openCreateModal?: boolean };
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
        initialParams={{ openCreateModal: false }}
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

  function CustomTabBar({ state, descriptors, navigation }: any) {
    const isProfileScreen = state.index === 2;

    if (isProfileScreen) {
      // Render the floating pill tab bar for the Profile screen (no plus button)
      return (
        <View style={[ styles.customTabBarContainer, { bottom: insets.bottom > 0 ? insets.bottom : 8 } ]}>
            <View style={styles.profileFloatingTabBar}>
                <TouchableOpacity
                    accessibilityRole="button"
                    onPress={() => navigation.navigate('Home', { screen: 'Map' })}
                    style={styles.tabButton}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons name="home" size={28} color={'#8E8E93'} />
                </TouchableOpacity>
                <TouchableOpacity
                    accessibilityRole="button"
                    accessibilityState={{ selected: true }}
                    onPress={() => navigation.navigate('Profile')}
                    style={styles.tabButton}
                    activeOpacity={0.7}
                >
                    <MaterialCommunityIcons name="account" size={28} color={'#fff'} />
                </TouchableOpacity>
            </View>
        </View>
      );
    }

    // Render the floating tab bar with the plus button for the Home screen
    return (
      <View style={[ styles.customTabBarContainer, { bottom: insets.bottom > 0 ? insets.bottom : 8 } ]}>
        <View style={styles.customTabBar}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={state.index === 0 ? { selected: true } : {}}
            onPress={() => navigation.navigate('Home', { screen: 'Map' })}
            style={styles.tabButton}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="home" size={28} color={state.index === 0 ? '#fff' : '#8E8E93'} />
          </TouchableOpacity>

          <View style={{ flex: 1 }} />

          <TouchableOpacity
            accessibilityRole="button"
            accessibilityState={state.index === 2 ? { selected: true } : {}}
            onPress={() => navigation.navigate('Profile')}
            style={styles.tabButton}
            activeOpacity={0.7}
          >
            <MaterialCommunityIcons name="account" size={28} color={state.index === 2 ? '#fff' : '#8E8E93'} />
          </TouchableOpacity>
        </View>
        
        <TouchableOpacity
          style={styles.plusButton} 
          activeOpacity={0.8}
          onPress={() => {
            navigation.navigate('Home', { screen: 'Map', params: { openCreateModal: true } });
          }}
        >
          <MaterialCommunityIcons name="plus" size={32} color="#fff" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <Tab.Navigator
      tabBar={props => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen name="Home" component={HomeStackScreen} />
      <Tab.Screen name="Add" component={View} listeners={{ tabPress: e => e.preventDefault() }} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  customTabBarContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  customTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '65%',
    height: 64,
    backgroundColor: '#2C2C2E',
    borderRadius: 32,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  profileFloatingTabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '50%', // Make it a bit narrower for two items
    height: 64,
    backgroundColor: '#2C2C2E',
    borderRadius: 32,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 10,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plusButton: {
    position: 'absolute',
    top: -24,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    borderWidth: 4,
    borderColor: '#fff',
  },
});