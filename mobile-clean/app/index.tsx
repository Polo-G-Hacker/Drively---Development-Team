import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Redirect, useRouter } from 'expo-router';
import { useAuth } from '../contexts/auth-context';

const SplashScreen = () => {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Static web rendering can't know the AsyncStorage-backed auth state ahead of time,
  // so redirect to a stable login route and let that screen handle authenticated users.
  if (Platform.OS === 'web') {
    return <Redirect href="/login" />;
  }

  useEffect(() => {
    if (!isLoading) {
      if (user) {
        router.replace('/(tabs)');
      } else {
        router.replace('/login');
      }
    }
  }, [isLoading, user, router]);

  return (
    <LinearGradient
      colors={['#0066FF', '#0044CC']}
      style={styles.container}
    >
      <View style={styles.content}>
        <View style={styles.logoContainer}>
          <Text style={styles.logo}>Drive.ly</Text>
        </View>
        <Text style={styles.tagline}>Move Smart Across Africa</Text>
      </View>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  logoContainer: {
    marginBottom: 20,
  },
  logo: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  tagline: {
    fontSize: 18,
    color: '#FFFFFF',
    opacity: 0.9,
  },
});

export default SplashScreen;
