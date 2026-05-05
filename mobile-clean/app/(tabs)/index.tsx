import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '../../contexts/auth-context';
import { rideAPI } from '../../services/api/api-client';
import { initializeSocket, listenForRideUpdates, removeRideListeners } from '../../services/socket/socket-client';
import { useRouter } from 'expo-router';
import { RideMap } from '../../components/ride-map';
import type { RideLocation, RideMapRegion } from '../../components/ride-map.types';

const HomeScreen = () => {
  const router = useRouter();
  const [location, setLocation] = useState<RideLocation | null>(null);
  const [destination, setDestination] = useState('');
  const [vehicleType, setVehicleType] = useState('car');
  const [matches, setMatches] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [region, setRegion] = useState<RideMapRegion>({
    latitude: 3.848,
    longitude: 11.502,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const { user, token } = useAuth();

  useEffect(() => {
    requestLocationPermission();
    getCurrentLocation();
    if (token) {
      initializeSocket(token);
    }

    return () => {
      removeRideListeners();
    };
  }, [token]);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        const settingsAction =
          Platform.OS === 'web'
            ? undefined
            : {
                text: 'Open Settings',
                onPress: () => {
                  if (Platform.OS === 'ios') {
                    Linking.openURL('app-settings:');
                  } else {
                    Linking.openSettings();
                  }
                },
              };

        Alert.alert(
          'Location Permission Required',
          'Please enable location permission in your device settings to use Drive.ly. This is required to find nearby drivers and track your ride.',
          [{ text: 'Cancel', style: 'cancel' }, ...(settingsAction ? [settingsAction] : [])]
        );
        return false;
      }
      return true;
    } catch (err) {
      console.error('Error requesting location permission:', err);
      Alert.alert('Error', 'Failed to request location permission');
      return false;
    }
  };

  const getCurrentLocation = async () => {
    try {
      const hasPermission = await requestLocationPermission();
      if (!hasPermission) {
        return;
      }
      const currentLocation = await Location.getCurrentPositionAsync({});
      const newLocation = {
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      };
      setLocation(newLocation);
      setRegion({
        ...region,
        latitude: newLocation.latitude,
        longitude: newLocation.longitude,
      });
    } catch (error) {
      console.error('Error getting location:', error);
      Alert.alert(
        'Location Error',
        'Unable to get your current location. Please ensure location services are enabled in your device settings.'
      );
    }
  };

  const searchRides = async () => {
    if (!destination || !location) {
      Alert.alert('Error', 'Please enter destination and ensure location is enabled');
      return;
    }

    setIsSearching(true);

    try {
      const destCoords = {
        latitude: location.latitude + 0.01,
        longitude: location.longitude + 0.01,
      };

      const response = await rideAPI.searchRides({
        origin: 'Current Location',
        destination: destination,
        vehicleType: vehicleType,
      });

      if (response.success) {
        setMatches(response.data || []);
      } else {
        Alert.alert('Error', response.error || 'Failed to search for rides');
        return;
      }

      listenForRideUpdates({
        onRideAvailable: (data) => {
          console.log('Ride available:', data);
        },
        onRideAccepted: (data) => {
          router.push('/ride-tracking');
        },
        onRideStatusUpdated: (data) => {
          console.log('Ride status updated:', data);
        },
        onDriverLocationUpdate: (data) => {
          console.log('Driver location update:', data);
        },
        onNoMatchesFound: (data) => {
          Alert.alert('No Matches', data.message);
        },
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to search for rides');
    } finally {
      setIsSearching(false);
    }
  };

  const selectRide = (match) => {
    router.push('/ride-booking');
  };

  const getVehiclePrice = (type) => {
    return type === 'car' ? '2000 FCFA' : '1000 FCFA';
  };

  const handleZoomIn = () => {
    setRegion({
      ...region,
      latitudeDelta: region.latitudeDelta * 0.5,
      longitudeDelta: region.longitudeDelta * 0.5,
    });
  };

  const handleZoomOut = () => {
    setRegion({
      ...region,
      latitudeDelta: region.latitudeDelta * 2,
      longitudeDelta: region.longitudeDelta * 2,
    });
  };

  const resetToYaounde = () => {
    setRegion({
      latitude: 3.848,
      longitude: 11.502,
      latitudeDelta: 0.0922,
      longitudeDelta: 0.0421,
    });
  };

  return (
    <View style={styles.container}>
      <RideMap
        location={location}
        region={region}
        onRegionChangeComplete={setRegion}
      />

      <View style={styles.zoomButtonsContainer}>
        <TouchableOpacity style={styles.zoomButton} onPress={handleZoomIn}>
          <Ionicons name="add" size={24} color="#0066FF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomButton} onPress={handleZoomOut}>
          <Ionicons name="remove" size={24} color="#0066FF" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.zoomButton} onPress={resetToYaounde}>
          <Ionicons name="home" size={24} color="#0066FF" />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Where to?"
            value={destination}
            onChangeText={setDestination}
          />
        </View>
      </View>

      <ScrollView style={styles.bottomSheet}>
        <Text style={styles.sectionTitle}>Select Vehicle</Text>
        
        <View style={styles.vehicleOptions}>
          <TouchableOpacity
            style={[
              styles.vehicleOption,
              vehicleType === 'car' && styles.vehicleOptionActive,
            ]}
            onPress={() => setVehicleType('car')}
          >
            <Ionicons
              name="car"
              size={24}
              color={vehicleType === 'car' ? '#0066FF' : '#666'}
            />
            <Text style={styles.vehicleName}>Car</Text>
            <Text style={styles.vehiclePrice}>{getVehiclePrice('car')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.vehicleOption,
              vehicleType === 'bike' && styles.vehicleOptionActive,
            ]}
            onPress={() => setVehicleType('bike')}
          >
            <Ionicons
              name="bicycle"
              size={24}
              color={vehicleType === 'bike' ? '#0066FF' : '#666'}
            />
            <Text style={styles.vehicleName}>Bike</Text>
            <Text style={styles.vehiclePrice}>{getVehiclePrice('bike')}</Text>
          </TouchableOpacity>
        </View>

        {matches.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>Available Rides</Text>
            {matches.map((match, index) => (
              <TouchableOpacity
                key={index}
                style={styles.rideCard}
                onPress={() => selectRide(match)}
              >
                <View style={styles.rideInfo}>
                  <Text style={styles.driverName}>{match.driverName}</Text>
                  <Text style={styles.rideDetails}>
                    {match.vehiclePlate} • {match.vehicleColor}
                  </Text>
                  <Text style={styles.rideDetails}>Rating: {match.rating} ⭐</Text>
                </View>
                <View style={styles.ridePricing}>
                  <Text style={styles.rideFare}>{match.fare} FCFA</Text>
                  <Text style={styles.rideEta}>{match.estimatedArrival} min</Text>
                </View>
              </TouchableOpacity>
            ))}
          </>
        )}

        <TouchableOpacity
          style={styles.requestButton}
          onPress={searchRides}
          disabled={isSearching}
        >
          <Text style={styles.requestButtonText}>
            {isSearching ? 'Searching...' : 'Request Ride'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  searchContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    zIndex: 1,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '50%',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  vehicleOptions: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  vehicleOption: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    padding: 15,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    marginHorizontal: 5,
  },
  vehicleOptionActive: {
    borderColor: '#0066FF',
    backgroundColor: '#F0F8FF',
  },
  vehicleName: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 5,
  },
  vehiclePrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0066FF',
    marginTop: 5,
  },
  rideCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    marginBottom: 10,
  },
  rideInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  rideDetails: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  ridePricing: {
    alignItems: 'flex-end',
  },
  rideFare: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0066FF',
  },
  rideEta: {
    fontSize: 14,
    color: '#666',
  },
  requestButton: {
    backgroundColor: '#0066FF',
    borderRadius: 10,
    padding: 15,
    marginTop: 10,
  },
  requestButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  zoomButtonsContainer: {
    position: 'absolute',
    top: 120,
    right: 20,
    flexDirection: 'column',
    gap: 10,
    zIndex: 1,
  },
  zoomButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
});

export default HomeScreen;
