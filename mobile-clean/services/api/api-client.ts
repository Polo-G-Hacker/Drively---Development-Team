/**
 * API Client
 * Centralized HTTP client for making API calls to the Drive.ly backend
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, API_ENDPOINTS } from '../../config/api-config';
import type { ApiResponse, User, Ride, DriverProfile, Community, Transaction, PaymentData } from '../../types';

/**
 * Generic API call function
 * Handles authentication, error handling, and response parsing
 */
async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  try {
    const token = await AsyncStorage.getItem('token');
    
    const response = await fetch(`${API_CONFIG.BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    });

    const data = await response.json();

    if (response.ok) {
      return { success: true, data };
    } else {
      return { success: false, error: data.error || data.message || 'API call failed' };
    }
  } catch (error) {
    console.error('API call error:', error);
    return { success: false, error: (error as Error).message };
  }
}

/**
 * Authentication API
 */
export const authAPI = {
  login: async (phoneNumber: string, password: string) => {
    return apiCall<{ token: string; user: User }>(API_ENDPOINTS.AUTH.LOGIN, {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, password }),
    });
  },

  register: async (phoneNumber: string, password: string, name: string, role: string) => {
    return apiCall<{ token: string; user: User }>(API_ENDPOINTS.AUTH.REGISTER, {
      method: 'POST',
      body: JSON.stringify({ phoneNumber, password, name, role }),
    });
  },

  getMe: async () => {
    return apiCall<{ user: User }>(API_ENDPOINTS.AUTH.ME, {
      method: 'GET',
    });
  },

  logout: async () => {
    return apiCall<{ message: string }>(API_ENDPOINTS.AUTH.LOGOUT, {
      method: 'POST',
    });
  },
};

/**
 * Rides API
 */
export const rideAPI = {
  searchRides: async (params: { origin: string; destination: string; vehicleType?: string }) => {
    const queryParams = new URLSearchParams(params).toString();
    return apiCall<Ride[]>(`${API_ENDPOINTS.RIDES.SEARCH}?${queryParams}`, {
      method: 'GET',
    });
  },

  requestRide: async (data: { pickupLocation: any; dropoffLocation: any; vehicleType: string }) => {
    return apiCall<Ride>(API_ENDPOINTS.RIDES.REQUEST, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  acceptRide: async (rideId: string, driverId: string) => {
    return apiCall<Ride>(API_ENDPOINTS.RIDES.ACCEPT, {
      method: 'POST',
      body: JSON.stringify({ rideId, driverId }),
    });
  },

  getRideById: async (rideId: string) => {
    return apiCall<Ride>(API_ENDPOINTS.RIDES.GET_BY_ID(rideId), {
      method: 'GET',
    });
  },

  updateRideStatus: async (rideId: string, status: string) => {
    return apiCall<Ride>(API_ENDPOINTS.RIDES.UPDATE_STATUS(rideId), {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  },

  getRideHistory: async () => {
    return apiCall<Ride[]>(API_ENDPOINTS.RIDES.HISTORY, {
      method: 'GET',
    });
  },
};

/**
 * Drivers API
 */
export const driverAPI = {
  createProfile: async (data: { vehicleModel: string; vehiclePlateNumber: string; vehicleColor: string }) => {
    return apiCall<DriverProfile>(API_ENDPOINTS.DRIVERS.CREATE_PROFILE, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getProfile: async () => {
    return apiCall<DriverProfile>(API_ENDPOINTS.DRIVERS.GET_PROFILE, {
      method: 'GET',
    });
  },

  updateAvailability: async (data: { isAvailable: boolean; currentRoute?: any }) => {
    return apiCall<DriverProfile>(API_ENDPOINTS.DRIVERS.UPDATE_AVAILABILITY, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  getEarnings: async () => {
    return apiCall<{ totalEarnings: number; todayEarnings: number; rideCount: number }>(API_ENDPOINTS.DRIVERS.GET_EARNINGS, {
      method: 'GET',
    });
  },

  getNearbyDrivers: async (params: { latitude: number; longitude: number; radius?: number }) => {
    const queryParams = new URLSearchParams({
      latitude: params.latitude.toString(),
      longitude: params.longitude.toString(),
      ...(params.radius && { radius: params.radius.toString() }),
    }).toString();
    return apiCall<DriverProfile[]>(`${API_ENDPOINTS.DRIVERS.GET_NEARBY}?${queryParams}`, {
      method: 'GET',
    });
  },
};

/**
 * Passengers API
 */
export const passengerAPI = {
  getProfile: async () => {
    return apiCall<User>(API_ENDPOINTS.PASSENGERS.GET_PROFILE, {
      method: 'GET',
    });
  },

  updateLocation: async (data: { latitude: number; longitude: number }) => {
    return apiCall<User>(API_ENDPOINTS.PASSENGERS.UPDATE_LOCATION, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  getCommunities: async () => {
    return apiCall<Community[]>(API_ENDPOINTS.PASSENGERS.GET_COMMUNITIES, {
      method: 'GET',
    });
  },

  joinCommunity: async (communityId: string) => {
    return apiCall<Community>(API_ENDPOINTS.PASSENGERS.JOIN_COMMUNITY, {
      method: 'POST',
      body: JSON.stringify({ communityId }),
    });
  },

  leaveCommunity: async (communityId: string) => {
    return apiCall<{ message: string }>(API_ENDPOINTS.PASSENGERS.LEAVE_COMMUNITY, {
      method: 'POST',
      body: JSON.stringify({ communityId }),
    });
  },
};

/**
 * Payments API
 */
export const paymentAPI = {
  processPayment: async (data: { rideId: string; amount: number; method: string; cardDetails?: any }) => {
    return apiCall<Transaction>(API_ENDPOINTS.PAYMENTS.PROCESS, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getPaymentHistory: async () => {
    return apiCall<Transaction[]>(API_ENDPOINTS.PAYMENTS.HISTORY, {
      method: 'GET',
    });
  },

  addFunds: async (data: { amount: number; paymentDetails: any }) => {
    return apiCall<PaymentData>(API_ENDPOINTS.PAYMENTS.ADD_FUNDS, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};
