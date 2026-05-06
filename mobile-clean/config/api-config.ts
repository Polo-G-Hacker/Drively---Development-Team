/**
 * API Configuration
 * Centralized configuration for API endpoints and settings.
 *
 * Resolution order:
 * 1. `EXPO_PUBLIC_API_BASE_URL`
 * 2. Current web hostname
 * 3. Expo dev host URI for native development
 * 4. Platform fallback (`10.0.2.2` on Android, `localhost` elsewhere)
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

function extractHostname(value?: string | null) {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  try {
    const normalized = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
    return new URL(normalized).hostname || null;
  } catch {
    const withoutProtocol = trimmed.replace(/^[a-z]+:\/\//i, '').split('/')[0];
    const withoutPort = withoutProtocol.replace(/:\d+$/, '');
    return withoutPort.replace(/^\[/, '').replace(/\]$/, '') || null;
  }
}

function resolveExpoHost() {
  const manifestDebuggerHost = (Constants.manifest as { debuggerHost?: string } | null)?.debuggerHost;
  const candidates = [
    process.env.EXPO_PUBLIC_API_HOST,
    Constants.expoConfig?.hostUri,
    manifestDebuggerHost,
    Constants.linkingUri,
  ];

  for (const candidate of candidates) {
    const hostname = extractHostname(candidate);
    if (hostname) {
      return hostname;
    }
  }

  return null;
}

function normalizeNativeHost(hostname: string | null) {
  if (!hostname) {
    return null;
  }

  if (
    Platform.OS === 'android' &&
    (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0' || hostname === '::1')
  ) {
    return '10.0.2.2';
  }

  return hostname;
}

export function resolveServiceUrl(port: number, path = '') {
  const explicitBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  if (explicitBaseUrl && port === 3000 && path === '/api') {
    return explicitBaseUrl.replace(/\/+$/, '');
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hostname) {
    return `http://${window.location.hostname}:${port}${path}`;
  }

  const host = normalizeNativeHost(resolveExpoHost()) || (Platform.OS === 'android' ? '10.0.2.2' : 'localhost');
  return `http://${host}:${port}${path}`;
}

export const API_CONFIG = {
  BASE_URL: resolveServiceUrl(3000, '/api'),
  TIMEOUT: 10000,
  RETRY_ATTEMPTS: 3,
} as const;

export async function fetchWithTimeout(
  input: string,
  init: RequestInit = {},
  timeout = API_CONFIG.TIMEOUT
) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

export const API_ENDPOINTS = {
  // Authentication
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    ME: '/auth/me',
    SETTINGS: '/auth/settings',
    CHANGE_PASSWORD: '/auth/password',
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
    LIST: '/drivers',
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
  // Reviews
  REVIEWS: {
    ME: '/reviews/me',
    AUTHORED: '/reviews/authored',
    MY_REVIEW: (id: string) => `/reviews/my-review/${id}`,
    USER: (id: string) => `/reviews/user/${id}`,
    SUBMIT: '/reviews',
    UPDATE: (id: string) => `/reviews/${id}`,
  },
} as const;
