import { StyleSheet } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import type { RideMapProps } from './ride-map.types';

export function RideMap({ location, onRegionChangeComplete, region }: RideMapProps) {
  return (
    <MapView
      style={styles.map}
      region={region}
      onRegionChangeComplete={onRegionChangeComplete}
    >
      {location && (
        <Marker
          coordinate={location}
          title="Your Location"
          description="Pickup point"
        />
      )}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    flex: 1,
  },
});
