import { Redirect, Tabs } from 'expo-router';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/auth-context';

type TabIconName = React.ComponentProps<typeof Ionicons>['name'];

type LinkedTabIconProps = {
  activeIcon: TabIconName;
  inactiveIcon: TabIconName;
  color: string;
  focused: boolean;
  size: number;
};

function LinkedTabIcon({ activeIcon, inactiveIcon, color, focused, size }: LinkedTabIconProps) {
  return (
    <View style={styles.tabIconContainer}>
      <View style={[styles.activeTabBar, !focused && styles.activeTabBarHidden]} />
      <Ionicons name={focused ? activeIcon : inactiveIcon} size={size} color={color} />
    </View>
  );
}

export default function TabLayout() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return null;
  }

  if (!user) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#0B63F6',
        tabBarInactiveTintColor: '#64748B',
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: styles.tabBar,
        tabBarItemStyle: styles.tabBarItem,
        tabBarLabelStyle: styles.tabBarLabel,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused, size }) => (
            <LinkedTabIcon
              activeIcon="home"
              inactiveIcon="home-outline"
              color={color}
              focused={focused}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="communities"
        options={{
          title: 'Communities',
          tabBarIcon: ({ color, focused, size }) => (
            <LinkedTabIcon
              activeIcon="people"
              inactiveIcon="people-outline"
              color={color}
              focused={focused}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="trips"
        options={{
          title: 'Trips',
          tabBarIcon: ({ color, focused, size }) => (
            <LinkedTabIcon
              activeIcon="receipt"
              inactiveIcon="receipt-outline"
              color={color}
              focused={focused}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused, size }) => (
            <LinkedTabIcon
              activeIcon="person"
              inactiveIcon="person-outline"
              color={color}
              focused={focused}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: '#EEF2F7',
    borderTopWidth: 0,
    height: 74,
    paddingTop: 4,
    paddingBottom: 8,
    shadowColor: '#0F172A',
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 18,
  },
  tabBarItem: {
    paddingTop: 2,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 2,
  },
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 48,
  },
  activeTabBar: {
    width: 22,
    height: 3,
    borderRadius: 999,
    backgroundColor: '#0B63F6',
    marginBottom: 6,
  },
  activeTabBarHidden: {
    opacity: 0,
  },
});
