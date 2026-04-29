/**
 * TypeScript Type Definitions
 * Centralized type definitions for the entire application
 */

// User Types
export interface User {
  id: string;
  name: string;
  phoneNumber: string;
  role: 'passenger' | 'driver';
  rating?: number;
  wallet?: {
    balance: number;
    transactions: Transaction[];
  };
  [key: string]: any;
}

// Driver Types
export interface DriverProfile {
  userId: string;
  vehicleModel: string;
  vehiclePlateNumber: string;
  vehicleColor: string;
  isAvailable: boolean;
  currentRoute?: Route;
  earnings: number;
  rating?: number;
}

// Ride Types
export interface Ride {
  id: string;
  passengerId: string;
  driverId?: string;
  pickupLocation: Location;
  dropoffLocation: Location;
  fare: number;
  status: 'requested' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  vehicleType: 'car' | 'bike';
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
