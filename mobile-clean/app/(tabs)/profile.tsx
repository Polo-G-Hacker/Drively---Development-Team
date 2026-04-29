import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/auth-context';
import { passengerAPI, driverAPI } from '../../services/api/api-client';

const ProfileScreen = () => {
  const { user, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isDriver, setIsDriver] = useState(user?.role === 'driver');

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      if (isDriver) {
        const response = await driverAPI.getProfile();
        setProfile(response.driver);
      } else {
        const response = await passengerAPI.getProfile();
        setProfile(response.user);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const menuItems = [
    {
      icon: 'person-outline',
      title: 'Edit Profile',
      onPress: () => Alert.alert('Edit Profile', 'Profile editing coming soon'),
    },
    {
      icon: 'card-outline',
      title: 'Payment Methods',
      onPress: () => Alert.alert('Payment Methods', 'Payment methods management coming soon'),
    },
    {
      icon: 'time-outline',
      title: 'Ride History',
      onPress: () => Alert.alert('Ride History', 'Ride history coming soon'),
    },
    {
      icon: 'star-outline',
      title: 'Reviews',
      onPress: () => Alert.alert('Reviews', 'Reviews section coming soon'),
    },
    {
      icon: 'settings-outline',
      title: 'Settings',
      onPress: () => Alert.alert('Settings', 'Settings coming soon'),
    },
    {
      icon: 'help-circle-outline',
      title: 'Help & Support',
      onPress: () => Alert.alert('Help & Support', 'Help center coming soon'),
    },
    {
      icon: 'information-circle-outline',
      title: 'About',
      onPress: () => Alert.alert('About Drive.ly', 'Drive.ly - Move Smart Across Africa'),
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatarContainer}>
          <Ionicons name="person" size={60} color="#0066FF" />
        </View>
        <Text style={styles.name}>{user?.name || 'User'}</Text>
        <Text style={styles.phoneNumber}>{user?.phoneNumber || '+237 XXX XXX XXX'}</Text>
        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={20} color="#FFD700" />
          <Text style={styles.rating}>{profile?.rating || user?.rating || '0.0'}</Text>
        </View>
      </View>

      {isDriver && profile && (
        <View style={styles.driverCard}>
          <Text style={styles.cardTitle}>Driver Information</Text>
          <View style={styles.driverInfo}>
            <View style={styles.infoRow}>
              <Ionicons name="car" size={20} color="#666" />
              <Text style={styles.infoText}>{profile.vehicleModel}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="pricetag" size={20} color="#666" />
              <Text style={styles.infoText}>{profile.vehiclePlateNumber}</Text>
            </View>
            <View style={styles.infoRow}>
              <Ionicons name="color-palette" size={20} color="#666" />
              <Text style={styles.infoText}>{profile.vehicleColor}</Text>
            </View>
          </View>
        </View>
      )}

      <View style={styles.walletCard}>
        <Text style={styles.cardTitle}>Wallet Balance</Text>
        <Text style={styles.balance}>{user?.wallet?.balance || 0} FCFA</Text>
        <TouchableOpacity
          style={styles.addFundsButton}
          onPress={() => Alert.alert('Add Funds', 'Add funds feature coming soon')}
        >
          <Text style={styles.addFundsText}>+ Add Funds</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.menuContainer}>
        {menuItems.map((item, index) => (
          <TouchableOpacity
            key={index}
            style={styles.menuItem}
            onPress={item.onPress}
          >
            <Ionicons name={item.icon} size={24} color="#666" />
            <Text style={styles.menuText}>{item.title}</Text>
            <Ionicons name="chevron-forward" size={20} color="#CCCCCC" />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Ionicons name="log-out-outline" size={24} color="#FF4444" />
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>

      <Text style={styles.version}>Drive.ly v1.0.0</Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#FFFFFF',
    padding: 30,
    alignItems: 'center',
    marginBottom: 15,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F0F8FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 15,
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  phoneNumber: {
    fontSize: 16,
    color: '#666',
    marginBottom: 10,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rating: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  driverCard: {
    backgroundColor: '#FFFFFF',
    margin: 15,
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  driverInfo: {
    gap: 10,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 16,
    marginLeft: 10,
    color: '#333',
  },
  walletCard: {
    backgroundColor: '#0066FF',
    margin: 15,
    borderRadius: 15,
    padding: 20,
    marginBottom: 15,
  },
  balance: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 10,
  },
  addFundsButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 12,
    marginTop: 15,
    alignItems: 'center',
  },
  addFundsText: {
    color: '#0066FF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    margin: 15,
    borderRadius: 15,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    marginLeft: 15,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    margin: 15,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  logoutText: {
    color: '#FF4444',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 10,
  },
  version: {
    textAlign: 'center',
    color: '#999',
    fontSize: 12,
    marginBottom: 20,
  },
});

export default ProfileScreen;
