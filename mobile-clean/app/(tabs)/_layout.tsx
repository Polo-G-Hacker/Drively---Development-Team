import { Redirect, Tabs } from "expo-router";
import React, { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/auth-context";

export default function TabLayout() {
  const { user, isLoading } = useAuth();
  const isDriver = user?.role === "driver";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (isLoading) return null;

  if (!user) return <Redirect href="/login" />;

  return (
    <>
      <Tabs
        screenOptions={{
          tabBarActiveTintColor: "#0066FF",
          headerShown: false,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{
            title: "Home",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="home" size={size} color={color} />
            ),
          }}
        />
        <Tabs.Screen
          name="communities"
          options={{
            title: "Communities",
            tabBarIcon: ({ color, size }) => (
              <Ionicons name="people" size={size} color={color} />
            ),
          }}
        />
      </Tabs>

    </>
  );
}
