import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/auth-context';

const LoginScreen = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('passenger');
  const [isLoading, setIsLoading] = useState(false);

  const { login, register } = useAuth();
  const router = useRouter();

  const handleAuth = async () => {
    if (!phoneNumber || !password) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!isLogin && !name) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    setIsLoading(true);

    try {
      let result;
      if (isLogin) {
        result = await login(phoneNumber, password);
      } else {
        result = await register(phoneNumber, password, name, role);
      }

      if (result.success) {
        if (!isLogin) {
          // Registration successful - switch to login mode
          Alert.alert('Success', 'Registration successful! Please login with your credentials.');
          setIsLogin(true);
          setName('');
        } else {
          // Login successful - navigate to tabs
          router.replace('/(tabs)');
        }
      } else {
        Alert.alert('Error', result.error);
      }
    } catch (error) {
      Alert.alert('Error', 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={['#0066FF', '#0044CC']}
      style={styles.container}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            <Text style={styles.logo}>Drive.ly</Text>
            <Text style={styles.subtitle}>
              {isLogin ? 'Welcome Back!' : 'Create Account'}
            </Text>

            {!isLogin && (
              <View style={styles.inputContainer}>
                <TextInput
                  style={styles.input}
                  placeholder="Full Name"
                  placeholderTextColor="#FFFFFF80"
                  value={name}
                  onChangeText={setName}
                />
              </View>
            )}

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Phone Number"
                placeholderTextColor="#FFFFFF80"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor="#FFFFFF80"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
            </View>

            {!isLogin && (
              <View style={styles.roleSelector}>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    role === 'passenger' && styles.roleButtonActive,
                  ]}
                  onPress={() => setRole('passenger')}
                >
                  <Text
                    style={[
                      styles.roleButtonText,
                      role === 'passenger' && styles.roleButtonTextActive,
                    ]}
                  >
                    Passenger
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.roleButton,
                    role === 'driver' && styles.roleButtonActive,
                  ]}
                  onPress={() => setRole('driver')}
                >
                  <Text
                    style={[
                      styles.roleButtonText,
                      role === 'driver' && styles.roleButtonTextActive,
                    ]}
                  >
                    Driver
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity
              style={styles.button}
              onPress={handleAuth}
              disabled={isLoading}
            >
              <Text style={styles.buttonText}>
                {isLoading ? 'Processing...' : isLogin ? 'Login' : 'Sign Up'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
              <Text style={styles.switchText}>
                {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Login'}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  content: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 20,
    color: '#FFFFFF',
    marginBottom: 30,
  },
  inputContainer: {
    width: '100%',
    marginBottom: 15,
  },
  input: {
    backgroundColor: '#FFFFFF20',
    borderRadius: 10,
    padding: 15,
    color: '#FFFFFF',
    fontSize: 16,
  },
  roleSelector: {
    flexDirection: 'row',
    width: '100%',
    marginBottom: 20,
  },
  roleButton: {
    flex: 1,
    padding: 12,
    borderRadius: 10,
    backgroundColor: '#FFFFFF20',
    marginHorizontal: 5,
  },
  roleButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  roleButtonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
  },
  roleButtonTextActive: {
    color: '#0066FF',
  },
  button: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 15,
    width: '100%',
    marginBottom: 20,
  },
  buttonText: {
    color: '#0066FF',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  switchText: {
    color: '#FFFFFF',
    fontSize: 14,
  },
});

export default LoginScreen;
