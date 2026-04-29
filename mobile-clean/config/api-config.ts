/**
 * API Configuration
 * Centralized configuration for API endpoints and settings
 * 
 * Note: For Android Emulator, use 10.0.2.2 instead of localhost
 */

export const API_CONFIG = {
  // BASE_URL: 'http://10.0.2.2:3000/api', // Android Emulator
  // BASE_URL: 'http://localhost:3000/api', // iOS Simulator
  BASE_URL: 'http://192.168.100.62:3000/api', // Physical Device
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
} as const;

export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    ME: '/auth/me',
    LOGOUT: '/auth/logout',
  },
  // Rides
  RIDES: {
    SEARCH: '/rides/search',
    REQUEST: '/rides/request',
    ACCEPT: '/rides/accept',
    GET_BY_ID: (id: string) => `/rides/${id}`,
    UPDATE_STATUS: (id: string) => `/rides/${id}/status`,
    HISTORY: '/rides/history/user',
  },
  // Drivers
  DRIVERS: {
    CREATE_PROFILE: '/drivers/profile',
    GET_PROFILE: '/drivers/profile',
    UPDATE_AVAILABILITY: '/drivers/availability',
    GET_EARNINGS: '/drivers/earnings',
    GET_NEARBY: '/drivers/nearby',
  },
  // Passengers
  PASSENGERS: {
    GET_PROFILE: '/passengers/profile',
    UPDATE_LOCATION: '/passengers/location',
    GET_COMMUNITIES: '/passengers/communities',
    JOIN_COMMUNITY: '/passengers/communities/join',
    LEAVE_COMMUNITY: '/passengers/communities/leave',
  },
  // Payments
  PAYMENTS: {
    PROCESS: '/payments/process',
    HISTORY: '/payments/history',
    ADD_FUNDS: '/payments/wallet/add',
  },
} as const;
