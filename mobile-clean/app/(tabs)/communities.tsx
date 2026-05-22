import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/auth-context";
import { router } from "expo-router";
import { communityAPI, passengerAPI } from "../../services/api/api-client";
import type { Community } from "../../types";
import { showFeedbackAlert } from "../../utils/show-feedback-alert";

const emptyCreateForm = {
  origin: "",
  destination: "",
  description: "",
};

const CommunitiesScreen = () => {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [userCommunities, setUserCommunities] = useState<Community[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [selectedCommunity, setSelectedCommunity] = useState<Community | null>(
    null,
  );
  const [isRideRequestVisible, setIsRideRequestVisible] = useState(false);
  const [isRequestingRide, setIsRequestingRide] = useState(false);
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const isDriver = user?.role === "driver";
  const isPassenger = user?.role === "passenger";
  const rideRequestModalMaxHeight = Math.min(
    height * 0.82,
    height - insets.top - 48,
  );
  const rideRequestModalBottomPadding = Math.max(insets.bottom, 14);

  useEffect(() => {
    void loadCommunityData();
  }, []);

  const loadCommunityData = async ({ silent = false } = {}) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const [communitiesResponse, userCommunitiesResponse] = await Promise.all([
        communityAPI.getCommunities(),
        passengerAPI.getCommunities(),
      ]);

      if (communitiesResponse.success) {
        setCommunities(communitiesResponse.data?.communities || []);
      }

      if (userCommunitiesResponse.success) {
        setUserCommunities(userCommunitiesResponse.data?.communities || []);
      }

      if (!communitiesResponse.success || !userCommunitiesResponse.success) {
        showFeedbackAlert(
          "Communities unavailable",
          communitiesResponse.error ||
            userCommunitiesResponse.error ||
            "Unable to load communities right now.",
        );
      }
    } catch (error) {
      console.error("Error loading communities:", error);
      showFeedbackAlert(
        "Communities unavailable",
        "Something went wrong while loading communities.",
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleJoinCommunity = async (communityId: string) => {
    try {
      const response = await passengerAPI.joinCommunity(communityId);
      if (!response.success) {
        showFeedbackAlert(
          "Join failed",
          response.error || "Failed to join community.",
        );
        return;
      }

      showFeedbackAlert(
        "Community joined",
        "Successfully joined the community.",
      );
      await loadCommunityData({ silent: true });
    } catch (error) {
      console.error("Error joining community:", error);
      showFeedbackAlert("Join failed", "Failed to join community.");
    }
  };

  const performLeaveCommunity = async (communityId: string) => {
    try {
      const response = await passengerAPI.leaveCommunity(communityId);
      if (!response.success) {
        showFeedbackAlert(
          "Leave failed",
          response.error || "Failed to leave community.",
        );
        return;
      }

      if (selectedCommunity?._id === communityId) {
        closeRideRequestModal();
      }

      showFeedbackAlert("Community left", "Successfully left the community.");
      await loadCommunityData({ silent: true });
    } catch (error) {
      console.error("Error leaving community:", error);
      showFeedbackAlert("Leave failed", "Failed to leave community.");
    }
  };

  const handleLeaveCommunity = (communityId: string) => {
    if (Platform.OS === "web" && typeof globalThis.confirm === "function") {
      const confirmed = globalThis.confirm(
        "Are you sure you want to leave this community?",
      );
      if (confirmed) {
        void performLeaveCommunity(communityId);
      }
      return;
    }

    Alert.alert(
      "Leave Community",
      "Are you sure you want to leave this community?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: () => {
            void performLeaveCommunity(communityId);
          },
        },
      ],
    );
  };

  const handleCreateCommunity = async () => {
    if (!isDriver) {
      return;
    }

    const origin = createForm.origin.trim();
    const destination = createForm.destination.trim();
    const description = createForm.description.trim();

    if (!origin || !destination) {
      showFeedbackAlert(
        "Missing route",
        "Origin and destination are required.",
      );
      return;
    }

    setIsSubmittingCreate(true);

    try {
      const response = await communityAPI.createCommunity({
        origin,
        destination,
        description: description || null,
      });

      if (!response.success) {
        const message = response.error || "Unable to create community.";
        showFeedbackAlert(
          message.includes("already exists")
            ? "Community exists"
            : "Create failed",
          message,
        );
        return;
      }

      setCreateForm(emptyCreateForm);
      showFeedbackAlert(
        "Community added",
        "The community is now live and has been added to your communities.",
      );
      await loadCommunityData({ silent: true });
    } catch (error) {
      console.error("Error creating community:", error);
      showFeedbackAlert(
        "Create failed",
        "Something went wrong while adding the community.",
      );
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const openRideRequestModal = (community: Community) => {
    setSelectedCommunity(community);
    setIsRideRequestVisible(true);
  };

  const closeRideRequestModal = () => {
    setIsRideRequestVisible(false);
    setSelectedCommunity(null);
  };

  const handleRequestRideFromCommunity = async () => {
    if (!selectedCommunity) {
      return;
    }

    if (!isPassenger) {
      showFeedbackAlert(
        "Passengers only",
        "Only passenger accounts can request rides from community routes.",
      );
      return;
    }

    setIsRequestingRide(true);

    try {
      const response = await communityAPI.requestRide(selectedCommunity._id);
      if (!response.success || !response.data) {
        showFeedbackAlert(
          "Ride request failed",
          response.error ||
            "Unable to request a ride from this community right now.",
        );
        return;
      }

      closeRideRequestModal();
      showFeedbackAlert(
        "Ride request sent",
        `${response.data.driver.name} has been notified for ${selectedCommunity.origin} to ${selectedCommunity.destination}. Estimated fare: ${response.data.fare} FCFA. ETA: ${response.data.estimatedArrival} min.`,
      );
    } catch (error) {
      console.error("Error requesting ride from community:", error);
      showFeedbackAlert(
        "Ride request failed",
        "Something went wrong while sending your ride request.",
      );
    } finally {
      setIsRequestingRide(false);
    }
  };

  const isUserMember = (communityId: string) => {
    return userCommunities.some(
      (community) =>
        community._id === communityId || community.id === communityId,
    );
  };

  const getDescription = (community: Community) => {
    return (
      community.description?.trim() ||
      `Community rides between ${community.origin} and ${community.destination}.`
    );
  };

  const getMemberLabel = (memberCount: number) => {
    return `${memberCount} ${memberCount === 1 ? "member" : "members"}`;
  };

  const matchesCommunitySearch = (community: Community) => {
    const searchValue = searchQuery.trim().toLowerCase();
    if (!searchValue) {
      return true;
    }

    const searchableText = [
      community.name,
      community.description || "",
      community.origin,
      community.destination,
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(searchValue);
  };

  const filteredUserCommunities = userCommunities.filter(
    matchesCommunitySearch,
  );
  const filteredCommunities = communities.filter(matchesCommunitySearch);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0066FF" />
        <Text style={styles.loadingText}>Loading communities...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header Bar */}
      <View style={styles.headermain}>
        <Text style={styles.title}>Communities</Text>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push("/profile")}
        >
          <Ionicons name="person" size={22} color={"#2954ff"} />
        </TouchableOpacity>
      </View>
      <Text></Text>

      {/* Main Body */}
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadCommunityData({ silent: true })}
          />
        }
      >
        {/* Driver Form Block */}
        {isDriver && (
          <View style={styles.createCard}>
            <View style={styles.createHeader}>
              <Ionicons name="add-circle" size={22} color="#0066FF" />
              <Text style={styles.createTitle}>Add a community</Text>
            </View>
            <Text style={styles.createSubtitle}>
              Drivers can create a route community when a similar origin and
              destination pair does not already exist.
            </Text>
            <TextInput
              style={styles.formInput}
              placeholder="Origin"
              value={createForm.origin}
              onChangeText={(value) =>
                setCreateForm((current) => ({ ...current, origin: value }))
              }
              editable={!isSubmittingCreate}
            />
            <TextInput
              style={styles.formInput}
              placeholder="Destination"
              value={createForm.destination}
              onChangeText={(value) =>
                setCreateForm((current) => ({ ...current, destination: value }))
              }
              editable={!isSubmittingCreate}
            />
            <TextInput
              style={[styles.formInput, styles.multilineInput]}
              placeholder="Description (optional)"
              value={createForm.description}
              onChangeText={(value) =>
                setCreateForm((current) => ({ ...current, description: value }))
              }
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!isSubmittingCreate}
            />
            <TouchableOpacity
              style={[
                styles.primaryButton,
                isSubmittingCreate && styles.primaryButtonDisabled,
              ]}
              onPress={() => void handleCreateCommunity()}
              disabled={isSubmittingCreate}
            >
              <Text style={styles.primaryButtonText}>
                {isSubmittingCreate ? "Adding community..." : "Add community"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Search Bar Input */}
        <View style={styles.searchContainer}>
          <Ionicons
            name="search"
            size={20}
            color="#666"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search communities..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* User's Communities Block */}
        {userCommunities.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Your Communities</Text>
            {filteredUserCommunities.length === 0 ? (
              <View style={styles.emptyCard}>
                <Ionicons name="people-outline" size={28} color="#98A2B3" />
                <Text style={styles.emptyTitle}>
                  No joined communities found
                </Text>
                <Text style={styles.emptyText}>
                  Try a different search term for your communities.
                </Text>
              </View>
            ) : (
              filteredUserCommunities.map((community) => (
                <View key={community._id} style={styles.communityCard}>
                  <TouchableOpacity
                    style={styles.joinedCommunityTapArea}
                    activeOpacity={0.82}
                    onPress={() => openRideRequestModal(community)}
                  >
                    <View style={styles.communityInfo}>
                      <View style={styles.communityIcon}>
                        <Ionicons name="people" size={24} color="#0066FF" />
                      </View>
                      <View style={styles.communityDetails}>
                        <Text style={styles.communityName}>
                          {community.name}
                        </Text>
                        <Text style={styles.communityDescription}>
                          {getDescription(community)}
                        </Text>
                        <View style={styles.memberCount}>
                          <Ionicons name="person" size={14} color="#666" />
                          <Text style={styles.memberText}>
                            {getMemberLabel(community.memberCount)}
                          </Text>
                        </View>
                        <View style={styles.communityRouteHint}>
                          <Text style={styles.communityRouteHintText}>
                            {isPassenger
                              ? "Tap to request a ride on this route"
                              : "Tap to view this route"}
                          </Text>
                          <Ionicons
                            name="chevron-forward"
                            size={16}
                            color="#0066FF"
                          />
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.leaveButton}
                    onPress={() => handleLeaveCommunity(community._id)}
                  >
                    <Text style={styles.leaveButtonText}>Leave</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
        )}

        {/* Available Communities Block */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Communities</Text>
          {filteredCommunities.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="people-outline" size={28} color="#98A2B3" />
              <Text style={styles.emptyTitle}>No communities found</Text>
              <Text style={styles.emptyText}>
                {communities.length === 0
                  ? isDriver
                    ? "Be the first driver to add a route community."
                    : "No communities have been added yet."
                  : "Try a different search term."}
              </Text>
            </View>
          ) : (
            filteredCommunities.map((community) => {
              const isMember = isUserMember(community._id);

              return (
                <View key={community._id} style={styles.communityCard}>
                  <View style={styles.communityInfo}>
                    <View style={styles.communityIcon}>
                      <Ionicons
                        name="people"
                        size={24}
                        color={isMember ? "#00A86B" : "#0066FF"}
                      />
                    </View>
                    <View style={styles.communityDetails}>
                      <Text style={styles.communityName}>{community.name}</Text>
                      <Text style={styles.communityDescription}>
                        {getDescription(community)}
                      </Text>
                      <View style={styles.memberCount}>
                        <Ionicons name="person" size={14} color="#666" />
                        <Text style={styles.memberText}>
                          {getMemberLabel(community.memberCount)}
                        </Text>
                      </View>
                    </View>
                  </View>
                  {!isMember ? (
                    <TouchableOpacity
                      style={styles.joinButton}
                      onPress={() => void handleJoinCommunity(community._id)}
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
            })
          )}
        </View>

        {/* Static Info Block */}
        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#0066FF" />
          <Text style={styles.infoText}>
            Communities help you find rides faster by connecting you with
            drivers and passengers on your regular routes.
          </Text>
        </View>
      </ScrollView>

      {/* Ride Sheet Modal */}
      <Modal
        animationType="slide"
        visible={isRideRequestVisible}
        transparent
        statusBarTranslucent
        onRequestClose={closeRideRequestModal}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={[
              styles.modalWrapper,
              { paddingTop: Math.max(insets.top + 16, 32) },
            ]}
          >
            <View
              style={[
                styles.modalCard,
                { maxHeight: rideRequestModalMaxHeight },
              ]}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalHeaderCopy}>
                  <Text style={styles.modalTitle}>Request Ride</Text>
                  <Text style={styles.modalSubtitle}>
                    {selectedCommunity
                      ? `Send a ride request for ${selectedCommunity.origin} to ${selectedCommunity.destination}.`
                      : "Request a ride from this community route."}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.modalCloseButton}
                  onPress={closeRideRequestModal}
                  disabled={isRequestingRide}
                >
                  <Ionicons name="close" size={20} color="#475467" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <ScrollView
                  style={styles.modalScrollView}
                  contentContainerStyle={styles.modalScrollContent}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                >
                  {selectedCommunity && (
                    <View style={styles.routeSummaryCard}>
                      <View style={styles.routeSummaryHeader}>
                        <Ionicons
                          name="navigate-circle"
                          size={22}
                          color="#0066FF"
                        />
                        <Text style={styles.routeSummaryTitle}>
                          {selectedCommunity.name}
                        </Text>
                      </View>
                      <View style={styles.routeSummaryRow}>
                        <View style={styles.routeStopBlock}>
                          <Text style={styles.routeStopLabel}>Origin</Text>
                          <Text style={styles.routeStopValue}>
                            {selectedCommunity.origin}
                          </Text>
                        </View>
                        <Ionicons
                          name="arrow-forward"
                          size={18}
                          color="#98A2B3"
                        />
                        <View style={styles.routeStopBlock}>
                          <Text style={styles.routeStopLabel}>Destination</Text>
                          <Text style={styles.routeStopValue}>
                            {selectedCommunity.destination}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.routeSummaryDescription}>
                        {getDescription(selectedCommunity)}
                      </Text>
                      <View style={styles.routeSummaryMeta}>
                        <Ionicons name="people" size={16} color="#667085" />
                        <Text style={styles.routeSummaryMetaText}>
                          {getMemberLabel(selectedCommunity.memberCount)}
                        </Text>
                      </View>
                    </View>
                  )}

                  <View style={styles.modalInfoCard}>
                    <Text style={styles.modalInfoTitle}>
                      {isPassenger
                        ? "How this works"
                        : "Passenger-only ride requests"}
                    </Text>
                    <Text style={styles.modalInfoText}>
                      {isPassenger
                        ? "Drive.ly will match you with the best available driver already broadcasting this route and send your ride request instantly."
                        : "Drivers can join and manage communities, but only passenger accounts can request rides from a community route."}
                    </Text>
                  </View>
                </ScrollView>
              </View>

              <View
                style={[
                  styles.modalActions,
                  { paddingBottom: rideRequestModalBottomPadding + 4 },
                ]}
              >
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={closeRideRequestModal}
                  disabled={isRequestingRide}
                >
                  <Text style={styles.secondaryButtonText}>Close</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    styles.modalPrimaryButton,
                    (!isPassenger || isRequestingRide) &&
                      styles.primaryButtonDisabled,
                  ]}
                  onPress={() => void handleRequestRideFromCommunity()}
                  disabled={!isPassenger || isRequestingRide}
                >
                  <Text style={styles.primaryButtonText}>
                    {isRequestingRide ? "Sending request..." : "Request ride"}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
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
  contentContainer: {
    paddingBottom: 24,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F5F5F5",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#667085",
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
  createCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 15,
    marginBottom: 15,
    borderRadius: 16,
    padding: 16,
  },
  createHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  createTitle: {
    marginLeft: 8,
    fontSize: 18,
    fontWeight: "bold",
    color: "#0F172A",
  },
  createSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: "#667085",
    marginBottom: 14,
  },
  formInput: {
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: "#101828",
    backgroundColor: "#FFFFFF",
    marginBottom: 12,
  },
  multilineInput: {
    minHeight: 88,
  },
  primaryButton: {
    backgroundColor: "#0066FF",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "bold",
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 15,
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
    marginHorizontal: 15,
    marginBottom: 10,
    color: "#0F172A",
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
  joinedCommunityTapArea: {
    flex: 1,
    marginRight: 12,
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
    color: "#111827",
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
  communityRouteHint: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  communityRouteHintText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#0066FF",
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
  emptyCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 15,
    borderRadius: 15,
    padding: 24,
    alignItems: "center",
  },
  emptyTitle: {
    marginTop: 10,
    fontSize: 16,
    fontWeight: "bold",
    color: "#111827",
  },
  emptyText: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "#667085",
    textAlign: "center",
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
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "flex-end",
  },
  modalWrapper: {
    flex: 1,
    width: "100%",
    justifyContent: "flex-end",
  },
  modalCard: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    minHeight: 0,
    overflow: "hidden",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#EAECF0",
  },
  modalHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#0F172A",
  },
  modalSubtitle: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
    color: "#667085",
  },
  modalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F2F4F7",
    alignItems: "center",
    justifyContent: "center",
  },
  modalBody: {
    flex: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  modalScrollView: {
    flex: 1,
    flexShrink: 1,
    minHeight: 0,
  },
  modalScrollContent: {
    padding: 20,
    paddingBottom: 28,
  },
  routeSummaryCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },
  routeSummaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  routeSummaryTitle: {
    marginLeft: 10,
    fontSize: 17,
    fontWeight: "700",
    color: "#0F172A",
    flex: 1,
  },
  routeSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  routeStopBlock: {
    flex: 1,
  },
  routeStopLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#667085",
    marginBottom: 4,
    textTransform: "uppercase",
  },
  routeStopValue: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
  },
  routeSummaryDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: "#475467",
    marginBottom: 12,
  },
  routeSummaryMeta: {
    flexDirection: "row",
    alignItems: "center",
  },
  routeSummaryMetaText: {
    marginLeft: 6,
    fontSize: 13,
    color: "#667085",
    fontWeight: "600",
  },
  modalInfoCard: {
    backgroundColor: "#EEF4FF",
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
  },
  modalInfoTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1849A9",
    marginBottom: 8,
  },
  modalInfoText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#36517A",
  },
  modalActions: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderTopColor: "#EAECF0",
    padding: 16,
    gap: 12,
    flexShrink: 0,
  },
  secondaryButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#D0D5DD",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: {
    color: "#344054",
    fontSize: 15,
    fontWeight: "600",
  },
  modalPrimaryButton: {
    flex: 1,
  },
});

export default CommunitiesScreen;
