/**
 * API Client
 * Centralized HTTP client for making API calls to the Drive.ly backend
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, API_ENDPOINTS, fetchWithTimeout } from '../../config/api-config';
import type {
  ApiResponse,
  User,
  Ride,
  DriverProfile,
  Community,
  Transaction,
  PaymentData,
  UserSettings,
  Review,
} from '../../types';

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

    const response = await fetchWithTimeout(`${API_CONFIG.BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (response.ok) {
      return { success: true, data };
    } else {
      return { success: false, error: data.error || data.message || 'API call failed' };
    }
  } catch (error) {
    console.error('API call error:', error);
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? `Request timed out. Check that the backend is running at ${API_CONFIG.BASE_URL}.`
        : (error as Error).message;
    return { success: false, error: message };
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

  updateSettings: async (settings: UserSettings) => {
    return apiCall<{ message: string; user: User }>(API_ENDPOINTS.AUTH.SETTINGS, {
      method: 'PATCH',
      body: JSON.stringify({ settings }),
    });
  },

  changePassword: async (currentPassword: string, newPassword: string, confirmPassword: string) => {
    return apiCall<{ message: string; user: User }>(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
      method: 'PATCH',
      body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
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

// Fix: the backend /api/rides/search expects these specific query param names:
//   originLat, originLng, destLat, destLng
// The old signature sent `origin` and `destination` as strings, which the backend ignored.
export type SearchRidesParams = {
  originLat: number;
  originLng: number;
  destLat: number;
  destLng: number;
};

export const rideAPI = {
  // Fix: accept coordinate params and build the query string the backend actually reads.
  searchRides: async (params: SearchRidesParams) => {
    const queryParams = new URLSearchParams({
      originLat: String(params.originLat),
      originLng: String(params.originLng),
      destLat: String(params.destLat),
      destLng: String(params.destLng),
    }).toString();

    // Backend returns { matches: RideMatch[] }
    return apiCall<{ matches: any[] }>(`${API_ENDPOINTS.RIDES.SEARCH}?${queryParams}`, {
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
    return apiCall<{ rides: Ride[] }>(API_ENDPOINTS.RIDES.HISTORY, {
      method: 'GET',
    });
  },
};

/**
 * Drivers API
 */
export const driverAPI = {
  getAllDrivers: async () => {
    return apiCall<{ drivers: DriverProfile[] }>(API_ENDPOINTS.DRIVERS.LIST, {
      method: 'GET',
    });
  },

  createProfile: async (data: { vehicleModel: string; vehiclePlateNumber: string; vehicleColor: string }) => {
    return apiCall<{ message: string; driver: DriverProfile }>(API_ENDPOINTS.DRIVERS.CREATE_PROFILE, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getProfile: async () => {
    return apiCall<{ driver: DriverProfile }>(API_ENDPOINTS.DRIVERS.GET_PROFILE, {
      method: 'GET',
    });
  },

  updateProfile: async (data: {
    name?: string;
    phoneNumber?: string;
    email?: string | null;
    profileImage?: string | null;
    vehicleType?: 'car' | 'bike' | 'minibus';
    vehicleModel?: string;
    vehiclePlateNumber?: string;
    vehicleColor?: string;
    licenseNumber?: string;
  }) => {
    return apiCall<{ message: string; driver?: DriverProfile | null; user?: User }>(API_ENDPOINTS.DRIVERS.GET_PROFILE, {
      method: 'PATCH',
      body: JSON.stringify(data),
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
    return apiCall<{ user: User }>(API_ENDPOINTS.PASSENGERS.GET_PROFILE, {
      method: 'GET',
    });
  },

  updateProfile: async (data: {
    name?: string;
    phoneNumber?: string;
    email?: string | null;
    profileImage?: string | null;
  }) => {
    return apiCall<{ message: string; user: User }>(API_ENDPOINTS.PASSENGERS.GET_PROFILE, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  // Fix: this was defined but never called from the home screen. Now it is.
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

/**
 * Reviews API
 */
export const reviewAPI = {
  getMyReviews: async () => {
    return apiCall<{ reviews: Review[] }>(API_ENDPOINTS.REVIEWS.ME, {
      method: 'GET',
    });
  },

  getAuthoredReviews: async () => {
    return apiCall<{ reviews: Review[] }>(API_ENDPOINTS.REVIEWS.AUTHORED, {
      method: 'GET',
    });
  },

  getMyReviewForUser: async (revieweeId: string) => {
    return apiCall<{ review: Review | null }>(API_ENDPOINTS.REVIEWS.MY_REVIEW(revieweeId), {
      method: 'GET',
    });
  },

  getUserReviews: async (userId: string) => {
    return apiCall<{ reviews: Review[] }>(API_ENDPOINTS.REVIEWS.USER(userId), {
      method: 'GET',
    });
  },

  submitReview: async (data: {
    rideId?: string | null;
    revieweeId: string;
    rating: number;
    comment?: string;
  }) => {
    return apiCall<{ message: string; review: Review }>(API_ENDPOINTS.REVIEWS.SUBMIT, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateReview: async (reviewId: string, data: { rating?: number; comment?: string }) => {
    return apiCall<{ message: string; review: Review }>(API_ENDPOINTS.REVIEWS.UPDATE(reviewId), {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};