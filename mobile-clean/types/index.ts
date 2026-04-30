/**
 * TypeScript Type Definitions
 * Centralized type definitions for the entire application
 */

// User Types
export interface UserSettings {
  notifications: {
    rideUpdates: boolean;
    smsUpdates: boolean;
    promotions: boolean;
  };
  privacy: {
    shareLiveLocation: boolean;
    communityVisibility: boolean;
  };
  security: {
    loginAlerts: boolean;
  };
}

export interface User {
  id: string;
  _id?: string;
  name: string;
  phoneNumber: string;
  role: 'passenger' | 'driver';
  email?: string | null;
  profileImage?: string | null;
  settings?: UserSettings;
  rating?: number;
  wallet?: {
    balance: number;
    currency?: string;
    transactions?: Transaction[];
  };
  communities?: Community[];
  [key: string]: any;
}

// Driver Types
export interface DriverProfile {
  id?: string;
  _id?: string;
  user?: User | string;
  vehicleType?: 'car' | 'bike' | 'minibus';
  licenseNumber?: string;
  vehicleModel: string;
  vehiclePlateNumber: string;
  vehicleColor: string;
  isAvailable: boolean;
  currentRoute?: Route | null;
  currentRide?: string | null;
  maxPassengers?: number;
  currentPassengerCount?: number;
  totalEarnings?: number;
  totalRides?: number;
  rating?: number;
  isPremium?: boolean;
}

// Ride Types
export interface RideParticipant {
  id?: string;
  _id?: string;
  user?: User | string;
  pickupLocation?: {
    type?: 'Point';
    coordinates: number[];
  };
  dropoffLocation?: {
    type?: 'Point';
    coordinates: number[];
  };
  pickupAddress?: string;
  dropoffAddress?: string;
  status?: 'pending' | 'accepted' | 'picked_up' | 'dropped_off' | 'cancelled';
  fare?: number;
  distance?: number;
  duration?: number;
  joinedAt?: string;
}

export interface RideRouteSummary {
  origin?: string;
  destination?: string;
  originCoords?: {
    type?: 'Point';
    coordinates: number[];
  } | null;
  destinationCoords?: {
    type?: 'Point';
    coordinates: number[];
  } | null;
}

export interface Ride {
  id: string;
  _id?: string;
  passengerId?: string;
  driverId?: string;
  driver?: DriverProfile | string;
  passengers?: RideParticipant[];
  route?: RideRouteSummary;
  pickupLocation?: Location;
  dropoffLocation?: Location;
  fare?: number;
  totalFare?: number;
  commission?: number;
  driverEarnings?: number;
  status: 'searching' | 'active' | 'completed' | 'cancelled' | 'requested' | 'accepted' | 'in_progress';
  vehicleType?: 'car' | 'bike' | 'minibus';
  paymentStatus?: 'pending' | 'paid' | 'failed';
  paymentMethod?: string | null;
  transactionId?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  community?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RideMatch {
  driverName: string;
  vehiclePlate: string;
  vehicleColor: string;
  rating: number;
  fare: number;
  estimatedArrival: number;
  driverId: string;
}

// Location Types
export interface Location {
  latitude: number;
  longitude: number;
  address?: string;
}

export interface Route {
  origin: Location;
  destination: Location;
  waypoints?: Location[];
}

// Community Types
export interface Community {
  _id: string;
  name: string;
  description: string;
  origin: string;
  destination: string;
  memberCount: number;
}

// Payment Types
export interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  createdAt: string;
}

export interface PaymentData {
  rideId: string;
  amount: number;
  method: 'wallet' | 'card' | 'cash';
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Socket Event Types
export interface SocketEventData {
  [key: string]: any;
}

export interface RideAvailableData extends SocketEventData {
  rideId: string;
  driverInfo: DriverProfile;
  estimatedArrival: number;
}

export interface RideAcceptedData extends SocketEventData {
  rideId: string;
  driverLocation: Location;
}

export interface RideStatusUpdatedData extends SocketEventData {
  rideId: string;
  status: string;
}

export interface DriverLocationUpdateData extends SocketEventData {
  rideId: string;
  location: Location;
}

// Component Props Types
export interface ScreenProps {
  navigation?: any;
  route?: any;
}
