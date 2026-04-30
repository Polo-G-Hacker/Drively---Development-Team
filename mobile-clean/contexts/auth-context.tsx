import React, { createContext, useState, useContext, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_CONFIG, API_ENDPOINTS, fetchWithTimeout } from '../config/api-config';
import type { User, AuthResponse, ApiResponse } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (phoneNumber: string, password: string) => Promise<ApiResponse<AuthResponse>>;
  register: (phoneNumber: string, password: string, name: string, role: string) => Promise<ApiResponse<AuthResponse>>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function parseResponseBody(response: Response) {
  try {
    return await response.json();
  } catch {
    return {};
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStoredAuth();
  }, []);

  const loadStoredAuth = async () => {
    try {
      const storedToken = await AsyncStorage.getItem('token');
      const storedUser = await AsyncStorage.getItem('user');
      
      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      }
    } catch (error) {
      console.error('Error loading auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (phoneNumber: string, password: string) => {
    try {
      const url = `${API_CONFIG.BASE_URL}${API_ENDPOINTS.AUTH.LOGIN}`;
      console.log('Logging in to:', url);
      
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber, password }),
      });

      const data = await parseResponseBody(response);
      console.log('Login response:', data);

      if (response.ok) {
        await AsyncStorage.setItem('token', data.token);
        await AsyncStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return { success: true, data };
      } else {
        return { success: false, error: data.error };
      }
    } catch (error) {
      console.error('Login error:', error);
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? `Login request timed out. Check that the backend is running at ${API_CONFIG.BASE_URL}.`
          : 'Login failed: ' + (error as Error).message;
      return { success: false, error: message };
    }
  };

  const register = async (phoneNumber: string, password: string, name: string, role: string) => {
    try {
      const url = `${API_CONFIG.BASE_URL}${API_ENDPOINTS.AUTH.REGISTER}`;
      console.log('Registering to:', url);
      
      const response = await fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phoneNumber, password, name, role }),
      });

      const data = await parseResponseBody(response);
      console.log('Register response:', data);

      if (response.ok) {
        // Don't auto-login after registration - user must login manually
        return { success: true, data };
      } else {
        return { success: false, error: data.error || data.errors?.[0]?.msg };
      }
    } catch (error) {
      console.error('Registration error:', error);
      const message =
        error instanceof Error && error.name === 'AbortError'
          ? `Registration request timed out. Check that the backend is running at ${API_CONFIG.BASE_URL}.`
          : 'Registration failed: ' + (error as Error).message;
      return { success: false, error: message };
    }
  };

  const logout = async () => {
    try {
      await fetchWithTimeout(`${API_CONFIG.BASE_URL}${API_ENDPOINTS.AUTH.LOGOUT}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      await AsyncStorage.removeItem('token');
      await AsyncStorage.removeItem('user');
      setToken(null);
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
