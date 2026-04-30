/**
 * Socket.IO Configuration
 * Follows the same host resolution rules as the REST API.
 */

import { resolveServiceUrl } from './api-config';

export const SOCKET_CONFIG = {
  URL: process.env.EXPO_PUBLIC_SOCKET_URL?.trim()?.replace(/\/+$/, '') || resolveServiceUrl(3001),
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
