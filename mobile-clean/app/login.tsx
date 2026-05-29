import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/auth-context';
import { PasswordInput } from '../components/password-input';
import AuthHeroCar from '../components/auth-hero-car';
import { showFeedbackAlert } from '../utils/show-feedback-alert';

const { width } = Dimensions.get('window');

const LoginScreen = () => {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('passenger');
  const [isLoading, setIsLoading] = useState(false);

  const { login, register, user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && user) {
      router.replace('/(tabs)');
    }
  }, [authLoading, user, router]);

  const handleAuth = async () => {
    if (!phoneNumber || !password) {
      showFeedbackAlert('Error', 'Please fill in all fields');
      return;
    }

    if (!isLogin && !name) {
      showFeedbackAlert('Error', 'Please enter your name');
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
          showFeedbackAlert('Success', 'Registration successful! Please login with your credentials.');
          setIsLogin(true);
          setName('');
        } else {
          router.replace('/(tabs)');
        }
      } else {
        showFeedbackAlert('Error', result.error);
      }
    } catch {
      showFeedbackAlert('Error', 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const content = (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.keyboardView}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} bounces={false}>
        {/* TOP SECTION: Branding & Illustration */}
        <View style={styles.topSection}>
          <Text style={styles.title}>DRIVE.LY</Text>
          <Text style={styles.subtitle}>Move smart. Travel happier.</Text>
          
          <View style={styles.illustrationContainer}>
            <AuthHeroCar width={Math.min(width * 0.92, 360)} />
          </View>
        </View>

        {/* BOTTOM SHEET: Auth Actions */}
        <View style={styles.bottomSheet}>
          <View style={styles.sheetHeader}>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>WELCOME</Text>
            </View>
            <Text style={styles.sheetSubtitle}>
              Enter your details to jump right into your personalized travel experience.
            </Text>
          </View>

          {/* SEGMENT TOGGLE */}
          <View style={styles.toggleContainer}>
            <TouchableOpacity
              style={[styles.toggleButton, isLogin && styles.toggleButtonActive]}
              onPress={() => setIsLogin(true)}
            >
              <Text style={[styles.toggleText, isLogin && styles.toggleTextActive]}>Login</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleButton, !isLogin && styles.toggleButtonActive]}
              onPress={() => setIsLogin(false)}
            >
              <Text style={[styles.toggleText, !isLogin && styles.toggleTextActive]}>Sign Up</Text>
            </TouchableOpacity>
          </View>

          {/* FORM */}
          <View style={styles.formContainer}>
            {!isLogin && (
              <View style={styles.inputWrapper}>
                <Text style={styles.inputLabel}>FULL NAME</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your name"
                  placeholderTextColor="#A0A0A0"
                  value={name}
                  onChangeText={setName}
                />
              </View>
            )}

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>PHONE NUMBER</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your phone"
                placeholderTextColor="#A0A0A0"
                value={phoneNumber}
                onChangeText={setPhoneNumber}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputWrapper}>
              <Text style={styles.inputLabel}>PASSWORD</Text>
              <PasswordInput
                inputStyle={styles.input}
                iconColor="#A0A0A0"
                placeholder="Enter your password"
                placeholderTextColor="#A0A0A0"
                value={password}
                onChangeText={setPassword}
              />
            </View>

            {!isLogin && (
              <View style={styles.roleSelector}>
                <TouchableOpacity
                  style={[styles.roleButton, role === 'passenger' && styles.roleButtonActive]}
                  onPress={() => setRole('passenger')}
                >
                  <Text style={[styles.roleButtonText, role === 'passenger' && styles.roleButtonTextActive]}>
                    Passenger
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.roleButton, role === 'driver' && styles.roleButtonActive]}
                  onPress={() => setRole('driver')}
                >
                  <Text style={[styles.roleButtonText, role === 'driver' && styles.roleButtonTextActive]}>
                    Driver
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <TouchableOpacity style={styles.submitButton} onPress={handleAuth} disabled={isLoading}>
              <Text style={styles.submitButtonText}>
                {isLoading ? 'Processing...' : isLogin ? 'Login' : 'Sign Up'}
              </Text>
            </TouchableOpacity>

            <Text style={styles.termsText}>
              By continuing, you agree to our Terms and Privacy Policy.
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  return (
    <View style={styles.container}>
      {content}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F2C4A', // Deep premium blue background
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
  },
  topSection: {
    paddingTop: Platform.OS === 'ios' ? 70 : 50,
    paddingHorizontal: 24,
    alignItems: 'center',
    flex: 1,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: 2,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#B0C4DE',
    marginBottom: 10,
  },
  illustrationContainer: {
    width: width * 0.9,
    height: width * 0.45,
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 10,
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 36,
    borderTopRightRadius: 36,
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  sheetHeader: {
    alignItems: 'center',
    marginBottom: 24,
  },
  badge: {
    backgroundColor: '#F0F5FA',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0066FF',
    letterSpacing: 1,
  },
  sheetSubtitle: {
    fontSize: 13,
    color: '#687076',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#F0F2F5',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
  },
  toggleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  toggleButtonActive: {
    backgroundColor: '#0066FF',
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#687076',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  formContainer: {
    width: '100%',
  },
  inputWrapper: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#687076',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    borderRadius: 12,
    padding: 16,
    color: '#11181C',
    fontSize: 15,
  },
  roleSelector: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  roleButton: {
    flex: 1,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#F8F9FA',
    borderWidth: 1,
    borderColor: '#E9ECEF',
    marginHorizontal: 4,
  },
  roleButtonActive: {
    backgroundColor: '#E6F0FF',
    borderColor: '#0066FF',
  },
  roleButtonText: {
    color: '#687076',
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 14,
  },
  roleButtonTextActive: {
    color: '#0066FF',
  },
  submitButton: {
    backgroundColor: '#0066FF',
    borderRadius: 14,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 20,
    shadowColor: '#0066FF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
    elevation: 8,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  termsText: {
    fontSize: 12,
    color: '#A0A0A0',
    textAlign: 'center',
    lineHeight: 18,
  },
});

export default LoginScreen;

