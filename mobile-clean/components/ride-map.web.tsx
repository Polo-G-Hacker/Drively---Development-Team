import { StyleSheet, Text, View } from 'react-native';

import type { RideMapProps } from './ride-map.types';

export function RideMap(_: RideMapProps) {
  return (
    <View style={styles.webMapPlaceholder}>
      <Text style={styles.webMapText}>Map not available on web preview</Text>
      <Text style={styles.webMapSubtext}>Use Expo Go on your phone to see the map</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  webMapPlaceholder: {
    flex: 1,
    width: '100%',
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  webMapText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
  },
  webMapSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
});
