/**
 * Socket.IO Client
 * Real-time communication service for Drive.ly
 */

import { io, Socket } from 'socket.io-client';
import { SOCKET_CONFIG, SOCKET_EVENTS } from '../../config/socket-config';

let socket: Socket | null = null;

/**
 * Initialize Socket.IO connection
 * @param token - JWT authentication token
 */
export const initializeSocket = (token: string): Socket => {
  if (socket?.connected) {
    return socket;
  }

  socket = io(SOCKET_CONFIG.URL, {
    transports: [...SOCKET_CONFIG.TRANSPORTS],
    reconnection: SOCKET_CONFIG.RECONNECTION,
    reconnectionAttempts: SOCKET_CONFIG.RECONNECTION_ATTEMPTS,
    reconnectionDelay: SOCKET_CONFIG.RECONNECTION_DELAY,
    timeout: SOCKET_CONFIG.TIMEOUT,
  });

  socket.on('connect', () => {
    console.log('Socket connected');
    if (socket) {
      socket.emit(SOCKET_EVENTS.AUTHENTICATE, { token });
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });

  return socket;
};

/**
 * Get the current socket instance
 */
export const getSocket = (): Socket | null => {
  return socket;
};

/**
 * Disconnect socket connection
 */
export const disconnectSocket = (): void => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Listen for passenger ride updates
 * @param callbacks - Object containing callback functions for different events
 */
export const listenForRideUpdates = (callbacks: {
  onRideAvailable?: (data: any) => void;
  onRideAccepted?: (data: any) => void;
  onRideStatusUpdated?: (data: any) => void;
  onDriverLocationUpdate?: (data: any) => void;
  onNoMatchesFound?: (data: any) => void;
}): void => {
  if (!socket) {
    console.error('Socket not initialized');
    return;
  }

  if (callbacks.onRideAvailable) {
    socket.on(SOCKET_EVENTS.RIDE_AVAILABLE, callbacks.onRideAvailable);
  }

  if (callbacks.onRideAccepted) {
    socket.on(SOCKET_EVENTS.RIDE_ACCEPTED, callbacks.onRideAccepted);
  }

  if (callbacks.onRideStatusUpdated) {
    socket.on(SOCKET_EVENTS.RIDE_STATUS_UPDATED, callbacks.onRideStatusUpdated);
  }

  if (callbacks.onDriverLocationUpdate) {
    socket.on(SOCKET_EVENTS.DRIVER_LOCATION_UPDATE, callbacks.onDriverLocationUpdate);
  }

  if (callbacks.onNoMatchesFound) {
    socket.on(SOCKET_EVENTS.NO_MATCHES_FOUND, callbacks.onNoMatchesFound);
  }
};

/**
 * Remove passenger ride update listeners
 */
export const removeRideListeners = (): void => {
  if (!socket) {
    return;
  }

  socket.off(SOCKET_EVENTS.RIDE_AVAILABLE);
  socket.off(SOCKET_EVENTS.RIDE_ACCEPTED);
  socket.off(SOCKET_EVENTS.RIDE_STATUS_UPDATED);
  socket.off(SOCKET_EVENTS.DRIVER_LOCATION_UPDATE);
  socket.off(SOCKET_EVENTS.NO_MATCHES_FOUND);
};

/**
 * Listen for driver ride updates
 * @param callbacks - Object containing callback functions for different events
 */
export const listenForDriverUpdates = (callbacks: {
  onRouteMatched?: (data: any) => void;
  onRideRequest?: (data: any) => void;
}): void => {
  if (!socket) {
    console.error('Socket not initialized');
    return;
  }

  if (callbacks.onRouteMatched) {
    socket.on(SOCKET_EVENTS.ROUTE_MATCHED, callbacks.onRouteMatched);
  }

  if (callbacks.onRideRequest) {
    socket.on(SOCKET_EVENTS.RIDE_REQUEST, callbacks.onRideRequest);
  }
};

/**
 * Remove driver update listeners
 */
export const removeDriverListeners = (): void => {
  if (!socket) {
    return;
  }

  socket.off(SOCKET_EVENTS.ROUTE_MATCHED);
  socket.off(SOCKET_EVENTS.RIDE_REQUEST);
};

/**
 * Broadcast driver route
 * @param data - Route data including origin, destination, and waypoints
 */
export const broadcastDriverRoute = (data: {
  driverId: string;
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
  waypoints?: Array<{ latitude: number; longitude: number }>;
}): void => {
  if (!socket) {
    console.error('Socket not initialized');
    return;
  }

  socket.emit(SOCKET_EVENTS.DRIVER_BROADCAST_ROUTE, data);
};

/**
 * Accept a ride request
 * @param data - Ride acceptance data
 */
export const acceptRideRequest = (data: {
  rideId: string;
  driverId: string;
}): void => {
  if (!socket) {
    console.error('Socket not initialized');
    return;
  }

  socket.emit(SOCKET_EVENTS.RIDE_ACCEPTED, data);
};

/**
 * Update driver location
 * @param data - Location data
 */
export const updateDriverLocation = (data: {
  rideId: string;
  location: { latitude: number; longitude: number };
}): void => {
  if (!socket) {
    console.error('Socket not initialized');
    return;
  }

  socket.emit(SOCKET_EVENTS.DRIVER_LOCATION_UPDATE, data);
};
