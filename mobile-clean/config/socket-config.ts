/**
 * Socket.IO Configuration
 * Centralized configuration for Socket.IO connection settings
 * 
 * Note: For Android Emulator, use 10.0.2.2 instead of localhost
 * For iOS Simulator, localhost works fine
 * For physical device, use your computer's actual IP address
 */

export const SOCKET_CONFIG = {
  // URL: 'http://10.0.2.2:3001', // Android Emulator
  // URL: 'http://localhost:3001', // iOS Simulator
  URL: 'http://192.168.100.62:3001', // Physical Device
  TRANSPORTS: ['websocket'],
  RECONNECTION: true,
  RECONNECTION_ATTEMPTS: 5,
  RECONNECTION_DELAY: 1000,
  TIMEOUT: 10000,
} as const;

export const SOCKET_EVENTS = {
  // Client → Server
  AUTHENTICATE: 'authenticate',
  DRIVER_BROADCAST_ROUTE: 'driver:broadcast_route',
  
  // Server → Client (Passenger)
  RIDE_AVAILABLE: 'ride_available',
  RIDE_ACCEPTED: 'ride_accepted',
  RIDE_STATUS_UPDATED: 'ride_status_updated',
  DRIVER_LOCATION_UPDATE: 'driver_location_update',
  NO_MATCHES_FOUND: 'no_matches_found',
  
  // Server → Client (Driver)
  ROUTE_MATCHED: 'route_matched',
  RIDE_REQUEST: 'ride_request',
  
  // Connection events
  CONNECT: 'connect',
  DISCONNECT: 'disconnect',
  AUTHENTICATED: 'authenticated',
  ERROR: 'error',
} as const;
