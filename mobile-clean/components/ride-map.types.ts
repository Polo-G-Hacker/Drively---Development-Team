export type RideLocation = {
  latitude: number;
  longitude: number;
};

export type RideMapRegion = RideLocation & {
  latitudeDelta: number;
  longitudeDelta: number;
};

export interface RideMapProps {
  location: RideLocation | null;
  onRegionChangeComplete: (region: RideMapRegion) => void;
  region: RideMapRegion;
}
