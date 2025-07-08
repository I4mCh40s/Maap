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

  // Custom tab bar to achieve the floating, cutout, and raised + button effect
  function CustomTabBar({ state, descriptors, navigation }: any) {
    return (
      <View
        style={[
          styles.customTabBar,
          {
            position: 'absolute',          // ⭐ take it out of the flex flow
            left: 16,
            right: 16,
            bottom: insets.bottom + 8,     // ⭐ sits right above the gesture bar
          },
        ]}
      > 
        {/* Left tab */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={state.index === 0 ? { selected: true } : {}}
          onPress={() => {
            // Try to always go back to Map if on PowerUp modal
            const homeStack = navigation.getState().routes.find(r => r.name === 'Home');
            const nestedRoutes = homeStack?.state?.routes || [];
            const lastRoute = nestedRoutes[nestedRoutes.length - 1];
            if (lastRoute?.name === 'PowerUp' && navigation.canGoBack()) {
              navigation.goBack();
            } else {
              navigation.navigate('Home', { screen: 'Map' });
            }
          }}
          style={styles.tabButton}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="home" size={28} color={state.index === 0 ? '#fff' : '#7A7A7A'} />
        </TouchableOpacity>

        {/* Center cutout and raised + button */}
        <View style={[styles.plusCutoutContainer,
          { bottom: insets.bottom },   // lift the mask too
        ]} pointerEvents="box-none">
          <View style={styles.plusCutout} />
          <TouchableOpacity
            style={[styles.plusButton, { bottom: 12 }]}
            activeOpacity={0.8}
            onPress={() => {
              navigation.navigate('Home', { screen: 'Map', params: { openShoutModal: true } });
            }}
          >
            <MaterialCommunityIcons name="plus" size={32} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Right tab */}
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityState={state.index === 2 ? { selected: true } : {}}
          onPress={() => navigation.navigate('Profile')}
          style={styles.tabButton}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="account" size={28} color={state.index === 2 ? '#fff' : '#7A7A7A'} />
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
      <Tab.Screen name="Add" component={HomeStackScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}



const styles = StyleSheet.create({
  customTabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 64,                 // visible height
    backgroundColor: '#0F1325',
    borderRadius: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
    // NOTE: no paddingBottom here — we handled the inset in the parent
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  plusCutoutContainer: {
    position: 'absolute',
    left: '50%',
    top: -40, // <-- adjust this for perfect vertical alignment
    transform: [{ translateX: -40 }], // half of width
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center', // <-- center the button in the cutout
    zIndex: 2,
    pointerEvents: 'box-none',
  },
  plusCutout: {
    position: 'absolute',
    top: 40,
    left: 0,
    width: 80,
    height: 40,
    backgroundColor: '#181C2F',
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    zIndex: 1,
  },
  plusButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1976FF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    position: 'absolute',
    top: 0,
    left: 12,
    zIndex: 2,
    borderWidth: 4,
    borderColor: '#181C2F',
  },
});