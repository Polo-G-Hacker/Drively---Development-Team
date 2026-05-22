import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect } from "expo-router";
import { useAuth } from "../contexts/auth-context";

export default function SplashScreen() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <LinearGradient colors={["#0066FF", "#0044CC"]} style={styles.container}>
        <View style={styles.content}>
          <View style={styles.logoContainer}>
            <Text style={styles.logo}>Drive.ly</Text>
          </View>
          <Text style={styles.tagline}>Move Smart Across Africa</Text>
        </View>
      </LinearGradient>
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
  },
  content: {
    alignItems: "center",
  },
  logoContainer: {
    marginBottom: 20,
  },
  logo: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  tagline: {
    fontSize: 18,
    color: "#FFFFFF",
    opacity: 0.9,
  },
});
