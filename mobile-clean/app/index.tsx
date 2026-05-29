import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "../contexts/auth-context";
import AnimatedLogo from "../components/AnimatedLogo";

const MIN_SPLASH_DISPLAY_MS = 950;

export default function SplashScreen() {
  const { user, isLoading } = useAuth();
  const [hasMetMinimumDisplayTime, setHasMetMinimumDisplayTime] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setHasMetMinimumDisplayTime(true);
    }, MIN_SPLASH_DISPLAY_MS);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading || !hasMetMinimumDisplayTime) {
    return (
      <View style={styles.container}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <AnimatedLogo size={160} color="#0066FF" />
          </View>
          <View style={styles.textLogoContainer}>
            <Text style={styles.logoDrive}>drive</Text>
            <Text style={styles.logoLy}>.ly</Text>
          </View>
          <Text style={styles.tagline}>Move Smart Across Africa</Text>
        </View>
      </View>
    );
  }

  if (Platform.OS === "web") {
    return <Redirect href="/login" />;
  }

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  content: {
    alignItems: "center",
  },
  logoContainer: {
    marginBottom: 10,
  },
  textLogoContainer: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: -6,
    marginBottom: 18,
  },
  logoDrive: {
    fontSize: 48,
    fontWeight: "900",
    color: "#0066FF",
    letterSpacing: -1.5,
  },
  logoLy: {
    fontSize: 48,
    fontWeight: "900",
    color: "#6B96FF",
    letterSpacing: -1.5,
  },
  tagline: {
    fontSize: 18,
    color: "#687076",
    fontWeight: "500",
  },
});
