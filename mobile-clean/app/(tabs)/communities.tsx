import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/auth-context';
import { passengerAPI } from '../../services/api/api-client';
import { router } from 'expo-router';

const CommunitiesScreen = () => {
  const [communities, setCommunities] = useState([]);
  const [userCommunities, setUserCommunities] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { user } = useAuth();

  useEffect(() => {
    loadCommunities();
    loadUserCommunities();
  }, []);

  const loadCommunities = async () => {
    try {
      const mockCommunities = [
        {
          _id: '1',
          name: 'Melen → Centre Ville',
          description: 'Daily commuters from Melen to city center',
          origin: 'Melen',
          destination: 'Centre Ville',
          memberCount: 156,
        },
        {
          _id: '2',
          name: 'Akwa → Bastos',
          description: 'Business district commuters',
          origin: 'Akwa',
          destination: 'Bastos',
          memberCount: 89,
        },
        {
          _id: '3',
          name: 'University → City Center',
          description: 'Student commuters route',
          origin: 'University',
          destination: 'City Center',
          memberCount: 234,
        },
        {
          _id: '4',
          name: 'Messamendongo → Bonapriso',
          description: 'Residential to business area',
          origin: 'Messamendongo',
          destination: 'Bonapriso',
          memberCount: 67,
        },
        {
          _id: '5',
          name: 'Kotto → Airport',
          description: 'Airport shuttle route',
          origin: 'Kotto',
          destination: 'Airport',
          memberCount: 45,
        },
      ];
      setCommunities(mockCommunities);
    } catch (error) {
      console.error('Error loading communities:', error);
    }
  };

  const loadUserCommunities = async () => {
    try {
      const response = await passengerAPI.getCommunities();
      setUserCommunities(response.communities || []);
    } catch (error) {
      console.error('Error loading user communities:', error);
    }
  };

  const handleJoinCommunity = async (communityId) => {
    try {
      await passengerAPI.joinCommunity(communityId);
      Alert.alert('Success', 'Successfully joined the community');
      loadUserCommunities();
    } catch (error) {
      Alert.alert('Error', 'Failed to join community');
    }
  };

  const handleLeaveCommunity = async (communityId) => {
    Alert.alert(
      'Leave Community',
      'Are you sure you want to leave this community?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          onPress: async () => {
            try {
              await passengerAPI.leaveCommunity(communityId);
              Alert.alert('Success', 'Successfully left the community');
              loadUserCommunities();
            } catch (error) {
              Alert.alert('Error', 'Failed to leave community');
            }
          },
        },
      ]
    );
  };

  const isUserMember = (communityId) => {
    return userCommunities.some(uc => uc._id === communityId);
  };

  const filteredCommunities = communities.filter(community =>
    community.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    community.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    
    <View style={styles.container}>
      <View style={styles.headermain}>
              <Text style={styles.title}>Communities</Text>
              <TouchableOpacity
                style={styles.profileButton}
                onPress={() => router.push("/profile")}
              >
                <Ionicons name="person" size={22} color={"#2954ff"} />
              </TouchableOpacity>
            </View>

    <ScrollView style={styles.container}>
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search communities..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {userCommunities.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your Communities</Text>
          {userCommunities.map((community) => (
            <View key={community._id} style={styles.communityCard}>
              <View style={styles.communityInfo}>
                <View style={styles.communityIcon}>
                  <Ionicons name="people" size={24} color="#0066FF" />
                </View>
                <View style={styles.communityDetails}>
                  <Text style={styles.communityName}>{community.name}</Text>
                  <Text style={styles.communityDescription}>{community.description}</Text>
                  <View style={styles.memberCount}>
                    <Ionicons name="person" size={14} color="#666" />
                    <Text style={styles.memberText}>{community.memberCount} members</Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.leaveButton}
                onPress={() => handleLeaveCommunity(community._id)}
              >
                <Text style={styles.leaveButtonText}>Leave</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Available Communities</Text>
        {filteredCommunities.map((community) => {
          const isMember = isUserMember(community._id);
          return (
            <View key={community._id} style={styles.communityCard}>
              <View style={styles.communityInfo}>
                <View style={styles.communityIcon}>
                  <Ionicons name="people" size={24} color={isMember ? "#00FF00" : "#0066FF"} />
                </View>
                <View style={styles.communityDetails}>
                  <Text style={styles.communityName}>{community.name}</Text>
                  <Text style={styles.communityDescription}>{community.description}</Text>
                  <View style={styles.memberCount}>
                    <Ionicons name="person" size={14} color="#666" />
                    <Text style={styles.memberText}>{community.memberCount} members</Text>
                  </View>
                </View>
              </View>
              {!isMember ? (
                <TouchableOpacity
                  style={styles.joinButton}
                  onPress={() => handleJoinCommunity(community._id)}
                >
                  <Text style={styles.joinButtonText}>Join</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.joinedBadge}>
                  <Text style={styles.joinedText}>Joined</Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={24} color="#0066FF" />
        <Text style={styles.infoText}>
          Communities help you find rides faster by connecting you with drivers and passengers on your regular routes.
        </Text>
      </View>
    </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F5F5F5",
  },
  headermain: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: { fontSize: 30, fontWeight: "700", color: "#0048ff" },
  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 34,
    backgroundColor: "#ffffff",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#2954ff",
  },

  header: {
    padding: 20,
    backgroundColor: "#FFFFFF",
    marginBottom: 15,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#0066FF",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#666",
    marginTop: 5,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    margin: 15,
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    margin: 15,
    marginBottom: 10,
  },
  communityCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 15,
    marginBottom: 10,
    borderRadius: 15,
    padding: 15,
  },
  communityInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  communityIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F0F8FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  communityDetails: {
    flex: 1,
  },
  communityName: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 5,
  },
  communityDescription: {
    fontSize: 14,
    color: "#666",
    marginBottom: 5,
  },
  memberCount: {
    flexDirection: "row",
    alignItems: "center",
  },
  memberText: {
    fontSize: 12,
    color: "#666",
    marginLeft: 5,
  },
  joinButton: {
    backgroundColor: "#0066FF",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  joinButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  leaveButton: {
    backgroundColor: "#FF4444",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  leaveButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "bold",
  },
  joinedBadge: {
    backgroundColor: "#E0E0E0",
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  joinedText: {
    color: "#666",
    fontSize: 14,
    fontWeight: "bold",
  },
  infoCard: {
    flexDirection: "row",
    backgroundColor: "#F0F8FF",
    margin: 15,
    borderRadius: 15,
    padding: 15,
    alignItems: "flex-start",
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: "#333",
    marginLeft: 10,
    lineHeight: 20,
  },
});

export default CommunitiesScreen;
