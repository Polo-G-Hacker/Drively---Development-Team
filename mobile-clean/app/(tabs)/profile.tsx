import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/auth-context';
import { authAPI, driverAPI, passengerAPI, rideAPI } from '../../services/api/api-client';
import type { DriverProfile, Ride, RideParticipant, User, UserSettings } from '../../types';
import { PasswordInput } from '../../components/password-input';
import { showFeedbackAlert } from '../../utils/show-feedback-alert';

type VehicleType = 'car' | 'bike' | 'minibus';

type EditProfileForm = {
  name: string;
  phoneNumber: string;
  email: string;
  vehicleType: VehicleType;
  vehicleModel: string;
  vehiclePlateNumber: string;
  vehicleColor: string;
  licenseNumber: string;
};

type PasswordForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type MenuItem = {
  description?: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  onPress: () => void;
};

const emptyForm: EditProfileForm = {
  name: '',
  phoneNumber: '',
  email: '',
  vehicleType: 'car',
  vehicleModel: '',
  vehiclePlateNumber: '',
  vehicleColor: '',
  licenseNumber: '',
};

const emptyPasswordForm: PasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const defaultSettings: UserSettings = {
  notifications: {
    rideUpdates: true,
    smsUpdates: true,
    promotions: false,
  },
  privacy: {
    shareLiveLocation: true,
    communityVisibility: true,
  },
  security: {
    loginAlerts: true,
  },
};

const statusColors: Record<string, string> = {
  active: '#0EA5E9',
  searching: '#F59E0B',
  completed: '#10B981',
  cancelled: '#EF4444',
  accepted: '#2563EB',
  requested: '#7C3AED',
  in_progress: '#0EA5E9',
};

function mergeSettings(settings?: Partial<UserSettings> | null): UserSettings {
  return {
    notifications: {
      ...defaultSettings.notifications,
      ...(settings?.notifications || {}),
    },
    privacy: {
      ...defaultSettings.privacy,
      ...(settings?.privacy || {}),
    },
    security: {
      ...defaultSettings.security,
      ...(settings?.security || {}),
    },
  };
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('Failed to read the selected image.'));
    };

    reader.onerror = () => reject(new Error('Failed to read the selected image.'));
    reader.readAsDataURL(file);
  });
}

function resizeImageDataUrl(source: string, size = 320) {
  return new Promise<string>((resolve, reject) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      resolve(source);
      return;
    }

    const browserImage = new globalThis.Image();

    browserImage.onload = () => {
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      if (!context) {
        resolve(source);
        return;
      }

      const shortestSide = Math.min(browserImage.width, browserImage.height);
      const sourceX = (browserImage.width - shortestSide) / 2;
      const sourceY = (browserImage.height - shortestSide) / 2;

      canvas.width = size;
      canvas.height = size;
      context.drawImage(browserImage, sourceX, sourceY, shortestSide, shortestSide, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };

    browserImage.onerror = () => reject(new Error('Failed to prepare the selected image.'));
    browserImage.src = source;
  });
}

function pickProfileImageFromBrowser() {
  return new Promise<string | null>((resolve, reject) => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      resolve(null);
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';

    input.onchange = async () => {
      try {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }

        if (file.size > 4 * 1024 * 1024) {
          reject(new Error('Choose an image smaller than 4 MB.'));
          return;
        }

        const rawDataUrl = await readFileAsDataUrl(file);
        const optimizedDataUrl = await resizeImageDataUrl(rawDataUrl);
        resolve(optimizedDataUrl);
      } catch (error) {
        reject(error);
      }
    };

    input.click();
  });
}

function formatStatusLabel(status?: string) {
  if (!status) {
    return 'Unknown';
  }

  return status
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function formatRideDate(ride: Ride) {
  const referenceDate = ride.completedAt || ride.startedAt || ride.createdAt;

  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(referenceDate));
  } catch {
    return referenceDate;
  }
}

function getPassengerName(passenger?: RideParticipant) {
  if (!passenger?.user || typeof passenger.user !== 'object') {
    return null;
  }

  return passenger.user.name || null;
}

function getRideRouteLabel(ride: Ride) {
  const firstPassenger = ride.passengers?.[0];
  const lastPassenger = ride.passengers?.[ride.passengers.length - 1];
  const origin = ride.route?.origin || firstPassenger?.pickupAddress || 'Route start';
  const destination = ride.route?.destination || lastPassenger?.dropoffAddress || 'Route end';
  return `${origin} -> ${destination}`;
}

function getRideSecondaryLabel(ride: Ride, isDriver: boolean) {
  if (isDriver) {
    const passengerNames = (ride.passengers || [])
      .map((passenger) => getPassengerName(passenger))
      .filter((value): value is string => Boolean(value));

    if (passengerNames.length === 0) {
      return `${ride.passengers?.length || 0} passengers`;
    }

    if (passengerNames.length === 1) {
      return `Passenger: ${passengerNames[0]}`;
    }

    return `${passengerNames.length} passengers · ${passengerNames[0]} +${passengerNames.length - 1}`;
  }

  if (ride.driver && typeof ride.driver === 'object') {
    const driverUser =
      ride.driver.user && typeof ride.driver.user === 'object' ? ride.driver.user : null;
    const baseLabel = driverUser?.name || ride.driver.vehicleModel || 'Driver assigned';
    const vehicleBits = [ride.driver.vehicleModel, ride.driver.vehiclePlateNumber].filter(Boolean).join(' · ');
    return vehicleBits ? `${baseLabel} · ${vehicleBits}` : baseLabel;
  }

  return 'Driver details unavailable';
}

const ProfileScreen = () => {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { user, logout, updateStoredUser } = useAuth();
  const isDriver = user?.role === 'driver';
  const isCompactScreen = width < 390;
  const [driverProfile, setDriverProfile] = useState<DriverProfile | null>(null);
  const [passengerProfile, setPassengerProfile] = useState<User | null>(null);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isEditVisible, setIsEditVisible] = useState(false);
  const [isHistoryVisible, setIsHistoryVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [hasLoadedHistory, setHasLoadedHistory] = useState(false);
  const [rideHistory, setRideHistory] = useState<Ride[]>([]);
  const [form, setForm] = useState<EditProfileForm>(emptyForm);
  const [settingsForm, setSettingsForm] = useState<UserSettings>(defaultSettings);
  const [passwordForm, setPasswordForm] = useState<PasswordForm>(emptyPasswordForm);

  useEffect(() => {
    loadProfile();
  }, [user?.id, isDriver]);

  const driverUser =
    driverProfile && driverProfile.user && typeof driverProfile.user === 'object' ? driverProfile.user : null;
  const displayUser = (isDriver ? driverUser : passengerProfile) || user;
  const displayRating = driverProfile?.rating ?? displayUser?.rating ?? 0;
  const walletBalance = displayUser?.wallet?.balance ?? 0;
  const walletCurrency = displayUser?.wallet?.currency ?? 'FCFA';
  const displayProfileImage = displayUser?.profileImage || null;
  const historyCountLabel = useMemo(() => {
    if (isDriver) {
      const total = driverProfile?.totalRides ?? rideHistory.length;
      return `${total} rides recorded`;
    }

    if (hasLoadedHistory) {
      return `${rideHistory.length} trips found`;
    }

    return 'See your completed and recent rides';
  }, [driverProfile?.totalRides, hasLoadedHistory, isDriver, rideHistory.length]);
  const latestRideLabel = rideHistory[0] ? getRideRouteLabel(rideHistory[0]) : 'No rides loaded yet';
  const settingsSummary = useMemo(() => {
    const summary = mergeSettings(displayUser?.settings);
    const labels: string[] = [];

    if (summary.notifications.rideUpdates) {
      labels.push('ride alerts');
    }

    if (summary.privacy.shareLiveLocation) {
      labels.push('live location');
    }

    if (summary.security.loginAlerts) {
      labels.push('security alerts');
    }

    return labels.length > 0 ? labels.join(', ') : 'Configure notifications and privacy';
  }, [displayUser?.settings]);

  const applyUserUpdate = async (nextUser: User) => {
    if (isDriver) {
      setDriverProfile((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          user: nextUser,
        };
      });
    } else {
      setPassengerProfile(nextUser);
    }

    await updateStoredUser(nextUser);
  };

  useEffect(() => {
    setSettingsForm(mergeSettings(displayUser?.settings));
  }, [displayUser?.settings]);

  const loadProfile = async () => {
    if (!user) {
      setIsLoadingProfile(false);
      return;
    }

    setIsLoadingProfile(true);

    try {
      if (isDriver) {
        const response = await driverAPI.getProfile();
        if (response.success && response.data?.driver) {
          setDriverProfile(response.data.driver);
        } else {
          setDriverProfile(null);
        }
      } else {
        const response = await passengerAPI.getProfile();
        if (response.success && response.data?.user) {
          setPassengerProfile(response.data.user);
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const loadRideHistory = async (forceRefresh = false) => {
    if (!user || isLoadingHistory || (hasLoadedHistory && !forceRefresh)) {
      return;
    }

    setIsLoadingHistory(true);
    setHistoryError(null);

    try {
      const response = await rideAPI.getRideHistory();

      if (!response.success || !response.data?.rides) {
        setHistoryError(response.error || 'Unable to load your ride history.');
        return;
      }

      setRideHistory(response.data.rides);
      setHasLoadedHistory(true);
    } catch (error) {
      console.error('Error loading ride history:', error);
      setHistoryError('Unable to load your ride history.');
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const openRideHistory = async () => {
    setIsHistoryVisible(true);
    await loadRideHistory();
  };

  const openEditProfile = () => {
    if (!displayUser) {
      return;
    }

    setForm({
      name: displayUser.name || '',
      phoneNumber: displayUser.phoneNumber || '',
      email: displayUser.email || '',
      vehicleType: driverProfile?.vehicleType || 'car',
      vehicleModel: driverProfile?.vehicleModel || '',
      vehiclePlateNumber: driverProfile?.vehiclePlateNumber || '',
      vehicleColor: driverProfile?.vehicleColor || '',
      licenseNumber: driverProfile?.licenseNumber || '',
    });
    setIsEditVisible(true);
  };

  const updateForm = (field: keyof EditProfileForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const updatePasswordField = (field: keyof PasswordForm, value: string) => {
    setPasswordForm((current) => ({ ...current, [field]: value }));
  };

  const updateSettingsField = <
    TSection extends keyof UserSettings,
    TField extends keyof UserSettings[TSection],
  >(
    section: TSection,
    field: TField,
    value: UserSettings[TSection][TField]
  ) => {
    setSettingsForm((current) => ({
      ...current,
      [section]: {
        ...current[section],
        [field]: value,
      },
    }));
  };

  const handleSaveProfile = async () => {
    if (!form.name.trim() || !form.phoneNumber.trim()) {
      showFeedbackAlert('Missing info', 'Name and phone number are required.');
      return;
    }

    if (isDriver && (!form.vehicleModel.trim() || !form.vehiclePlateNumber.trim() || !form.vehicleColor.trim())) {
      showFeedbackAlert('Missing vehicle info', 'Vehicle model, plate number, and color are required for drivers.');
      return;
    }

    setIsSaving(true);

    try {
      if (isDriver) {
        const response = await driverAPI.updateProfile({
          name: form.name.trim(),
          phoneNumber: form.phoneNumber.trim(),
          email: form.email.trim() || null,
          vehicleType: form.vehicleType,
          vehicleModel: form.vehicleModel.trim(),
          vehiclePlateNumber: form.vehiclePlateNumber.trim(),
          vehicleColor: form.vehicleColor.trim(),
          licenseNumber: form.licenseNumber.trim() || form.vehiclePlateNumber.trim(),
        });

        if (!response.success || (!response.data?.driver && !response.data?.user)) {
          showFeedbackAlert('Update failed', response.error || 'Unable to update your profile.');
          return;
        }

        const nextDriverProfile = response.data.driver;
        const nextUser =
          (nextDriverProfile?.user && typeof nextDriverProfile.user === 'object'
            ? nextDriverProfile.user
            : response.data.user) || {
            ...displayUser,
            name: form.name.trim(),
            phoneNumber: form.phoneNumber.trim(),
            email: form.email.trim() || null,
          };

        if (nextDriverProfile) {
          setDriverProfile(nextDriverProfile);
        }
        if (nextUser) {
          await applyUserUpdate(nextUser as User);
        }
      } else {
        const response = await passengerAPI.updateProfile({
          name: form.name.trim(),
          phoneNumber: form.phoneNumber.trim(),
          email: form.email.trim() || null,
        });

        if (!response.success || !response.data?.user) {
          showFeedbackAlert('Update failed', response.error || 'Unable to update your profile.');
          return;
        }

        setPassengerProfile(response.data.user);
        await applyUserUpdate(response.data.user);
      }

      setIsEditVisible(false);
      showFeedbackAlert('Profile updated', 'Your changes have been saved.');
    } catch (error) {
      console.error('Error saving profile:', error);
      showFeedbackAlert('Update failed', 'Something went wrong while saving your profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const openSettings = () => {
    setSettingsForm(mergeSettings(displayUser?.settings));
    setPasswordForm(emptyPasswordForm);
    setIsSettingsVisible(true);
  };

  const handleChangeProfileImage = async () => {
    if (!displayUser) {
      return;
    }

    if (Platform.OS !== 'web') {
      showFeedbackAlert(
        'Profile photo',
        'Profile photo uploads are available in the web build right now. We can add the native media picker next.'
      );
      return;
    }

    setIsUploadingImage(true);

    try {
      const profileImage = await pickProfileImageFromBrowser();
      if (!profileImage) {
        return;
      }

      if (isDriver) {
        const response = await driverAPI.updateProfile({ profileImage });

        if (!response.success || (!response.data?.driver && !response.data?.user)) {
          showFeedbackAlert('Upload failed', response.error || 'Unable to update your profile photo.');
          return;
        }

        if (response.data.driver) {
          setDriverProfile(response.data.driver);
        }
        const nextUser =
          (response.data.driver?.user && typeof response.data.driver.user === 'object'
            ? response.data.driver.user
            : response.data.user) || { ...displayUser, profileImage };

        await applyUserUpdate(nextUser as User);
      } else {
        const response = await passengerAPI.updateProfile({ profileImage });

        if (!response.success || !response.data?.user) {
          showFeedbackAlert('Upload failed', response.error || 'Unable to update your profile photo.');
          return;
        }

        setPassengerProfile(response.data.user);
        await applyUserUpdate(response.data.user);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to update your profile photo.';
      showFeedbackAlert('Upload failed', message);
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveSettings = async () => {
    const hasPasswordInput = Object.values(passwordForm).some((value) => value.length > 0);
    const hasSettingsChanges = JSON.stringify(mergeSettings(displayUser?.settings)) !== JSON.stringify(settingsForm);
    let passwordValidationError: string | null = null;

    if (hasPasswordInput) {
      if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
        passwordValidationError = 'Fill in your current password, new password, and confirmation.';
      } else if (passwordForm.newPassword.length < 6) {
        passwordValidationError = 'Your new password must be at least 6 characters.';
      } else if (passwordForm.newPassword !== passwordForm.confirmPassword) {
        passwordValidationError = 'The new password confirmation does not match.';
      }
    }

    if (!hasSettingsChanges && !hasPasswordInput) {
      showFeedbackAlert('Nothing to save', 'Update a setting or enter a new password before saving.');
      return;
    }

    setIsSavingSettings(true);

    try {
      let settingsSaved = false;
      let settingsError: string | null = null;
      let passwordChanged = false;
      let passwordError = passwordValidationError;

      if (hasSettingsChanges) {
        const settingsResponse = await authAPI.updateSettings(settingsForm);

        if (!settingsResponse.success || !settingsResponse.data?.user) {
          settingsError = settingsResponse.error || 'Unable to save your settings.';
        } else {
          await applyUserUpdate(settingsResponse.data.user);
          settingsSaved = true;
        }
      }

      if (hasPasswordInput && !passwordValidationError) {
        const passwordResponse = await authAPI.changePassword(
          passwordForm.currentPassword,
          passwordForm.newPassword,
          passwordForm.confirmPassword
        );

        if (!passwordResponse.success) {
          passwordError = passwordResponse.error || 'Unknown error.';
        } else {
          passwordChanged = true;
          setPasswordForm(emptyPasswordForm);
        }
      }

      if (settingsError || passwordError) {
        if (settingsSaved && passwordError) {
          showFeedbackAlert('Settings saved', `Your settings were saved, but your password could not be updated: ${passwordError}`);
          return;
        }

        if (passwordChanged && settingsError) {
          showFeedbackAlert('Password updated', `Your password was updated, but your settings could not be saved: ${settingsError}`);
          return;
        }

        if (settingsError && passwordError) {
          showFeedbackAlert('Update incomplete', `${settingsError} ${passwordError}`);
          return;
        }

        if (settingsError) {
          showFeedbackAlert('Settings failed', settingsError);
          return;
        }

        showFeedbackAlert('Password change', passwordError || 'Unable to update your password.');
        return;
      }

      if (settingsSaved || passwordChanged) {
        setPasswordForm(emptyPasswordForm);
        setIsSettingsVisible(false);
        showFeedbackAlert(
          passwordChanged && !settingsSaved ? 'Password updated' : 'Settings updated',
          settingsSaved && passwordChanged
            ? 'Your settings and password have been updated.'
            : settingsSaved
              ? 'Your settings have been saved.'
              : 'Your password has been updated.'
        );
        return;
      }

      showFeedbackAlert('Nothing to save', 'Update a setting or enter a new password before saving.');
    } catch (error) {
      console.error('Error saving settings:', error);
      showFeedbackAlert('Settings failed', 'Something went wrong while saving your settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleLogout = () => {
    const runLogout = async () => {
      setIsLoggingOut(true);

      try {
        await logout();
        router.replace('/login');
      } finally {
        setIsLoggingOut(false);
      }
    };

    if (Platform.OS === 'web') {
      const confirmed = globalThis.confirm('Are you sure you want to logout?');

      if (confirmed) {
        void runLogout();
      }

      return;
    }

    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        onPress: () => {
          void runLogout();
        },
      },
    ]);
  };

  const menuItems: MenuItem[] = [
    {
      icon: 'card-outline',
      title: 'Payment Methods',
      onPress: () => showFeedbackAlert('Payment Methods', 'Payment methods management coming soon'),
    },
    {
      icon: 'star-outline',
      title: 'Reviews',
      onPress: () => showFeedbackAlert('Reviews', 'Reviews section coming soon'),
    },
    {
      icon: 'settings-outline',
      title: 'Settings',
      description: settingsSummary,
      onPress: openSettings,
    },
    {
      icon: 'help-circle-outline',
      title: 'Help & Support',
      onPress: () => showFeedbackAlert('Help & Support', 'Help center coming soon'),
    },
    {
      icon: 'information-circle-outline',
      title: 'About',
      onPress: () => showFeedbackAlert('About Drive.ly', 'Drive.ly - Move Smart Across Africa'),
    },
  ];

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.avatarContainer}
            onPress={handleChangeProfileImage}
            disabled={isUploadingImage}
            activeOpacity={0.85}
          >
            {displayProfileImage ? (
              <Image source={{ uri: displayProfileImage }} style={styles.avatarImage} />
            ) : (
              <Ionicons name="person" size={60} color="#0066FF" />
            )}
            <View style={styles.avatarActionButton}>
              {isUploadingImage ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Ionicons name="camera" size={16} color="#FFFFFF" />
              )}
            </View>
          </TouchableOpacity>
          <Text style={styles.name}>{displayUser?.name || 'User'}</Text>
          <Text style={styles.phoneNumber}>{displayUser?.phoneNumber || '+237 XXX XXX XXX'}</Text>
          {displayUser?.email ? <Text style={styles.email}>{displayUser.email}</Text> : null}
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={20} color="#FFD700" />
            <Text style={styles.rating}>{Number(displayRating).toFixed(1)}</Text>
          </View>
          <TouchableOpacity style={styles.editButton} onPress={openEditProfile}>
            <Ionicons name="create-outline" size={18} color="#0066FF" />
            <Text style={styles.editButtonText}>Edit profile</Text>
          </TouchableOpacity>
        </View>

        {isDriver ? (
          <View style={styles.driverCard}>
            <Text style={styles.cardTitle}>Driver Information</Text>
            {driverProfile ? (
              <View style={styles.driverInfo}>
                <View style={styles.infoRow}>
                  <Ionicons name="car" size={20} color="#666" />
                  <Text style={styles.infoText}>{driverProfile.vehicleModel}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="pricetag" size={20} color="#666" />
                  <Text style={styles.infoText}>{driverProfile.vehiclePlateNumber}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="color-palette" size={20} color="#666" />
                  <Text style={styles.infoText}>{driverProfile.vehicleColor}</Text>
                </View>
                <View style={styles.infoRow}>
                  <Ionicons name="shield-checkmark" size={20} color="#666" />
                  <Text style={styles.infoText}>{driverProfile.licenseNumber || 'No license number yet'}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyDriverState}>
                <Text style={styles.emptyDriverText}>
                  Add your vehicle details to complete your driver profile.
                </Text>
                <TouchableOpacity style={styles.secondaryButton} onPress={openEditProfile}>
                  <Text style={styles.secondaryButtonText}>Complete setup</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        ) : null}

        <View style={styles.walletCard}>
          <Text style={styles.walletLabel}>Wallet Balance</Text>
          <Text style={styles.balance}>
            {walletBalance} {walletCurrency}
          </Text>
          <TouchableOpacity
            style={styles.addFundsButton}
                onPress={() => showFeedbackAlert('Add Funds', 'Add funds feature coming soon')}
          >
            <Text style={styles.addFundsText}>+ Add Funds</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.historyCard}>
          <View style={[styles.historyHeaderRow, isCompactScreen && styles.historyHeaderRowCompact]}>
            <View style={styles.historyHeaderCopy}>
              <Text style={styles.cardTitle}>Ride Activity</Text>
              <Text style={styles.historySummary}>{historyCountLabel}</Text>
            </View>
            <TouchableOpacity
              style={[styles.historyButton, isCompactScreen && styles.historyButtonCompact]}
              onPress={() => {
                void openRideHistory();
              }}
            >
              <Text style={styles.historyButtonText}>View history</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.historyPreviewRow}>
            <Ionicons name="time-outline" size={18} color="#0066FF" />
            <Text style={styles.historyPreviewText}>{latestRideLabel}</Text>
          </View>
        </View>

        <View style={styles.menuContainer}>
          {menuItems.map((item, index) => (
            <TouchableOpacity key={`${item.title}-${index}`} style={styles.menuItem} onPress={item.onPress}>
              <Ionicons name={item.icon} size={24} color="#666" />
              <View style={styles.menuTextBlock}>
                <Text style={styles.menuText}>{item.title}</Text>
                {item.description ? <Text style={styles.menuDescription}>{item.description}</Text> : null}
              </View>
              <Ionicons name="chevron-forward" size={20} color="#CCCCCC" />
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} disabled={isLoggingOut}>
          {isLoggingOut ? (
            <ActivityIndicator size="small" color="#FF4444" />
          ) : (
            <Ionicons name="log-out-outline" size={24} color="#FF4444" />
          )}
          <Text style={styles.logoutText}>{isLoggingOut ? 'Signing out...' : 'Logout'}</Text>
        </TouchableOpacity>

        {isLoadingProfile ? (
          <View style={styles.loadingBlock}>
            <ActivityIndicator size="small" color="#0066FF" />
            <Text style={styles.loadingText}>Refreshing profile...</Text>
          </View>
        ) : null}

        <Text style={styles.version}>Drive.ly v1.0.0</Text>
      </ScrollView>

      <Modal animationType="slide" visible={isEditVisible} transparent onRequestClose={() => setIsEditVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalWrapper}
          >
            <View style={styles.modalCard}>
              <View style={[styles.modalHeader, isCompactScreen && styles.modalHeaderCompact]}>
                <View style={styles.modalHeaderCopy}>
                  <Text style={styles.modalTitle}>Edit Profile</Text>
                  <Text style={styles.modalSubtitle}>Update your account details and save instantly.</Text>
                </View>
                <TouchableOpacity style={styles.closeIconButton} onPress={() => setIsEditVisible(false)}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  style={styles.modalScrollView}
                  contentContainerStyle={styles.modalScrollContent}
                >
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Full Name</Text>
                    <TextInput
                      style={styles.input}
                      value={form.name}
                      onChangeText={(value) => updateForm('name', value)}
                      placeholder="Enter your full name"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Phone Number</Text>
                    <TextInput
                      style={styles.input}
                      value={form.phoneNumber}
                      onChangeText={(value) => updateForm('phoneNumber', value)}
                      placeholder="Enter your phone number"
                      keyboardType="phone-pad"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>Email</Text>
                    <TextInput
                      style={styles.input}
                      value={form.email}
                      onChangeText={(value) => updateForm('email', value)}
                      placeholder="Optional email address"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      placeholderTextColor="#9CA3AF"
                    />
                  </View>

                  {isDriver ? (
                    <>
                      <Text style={styles.sectionTitle}>Driver Details</Text>

                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Vehicle Type</Text>
                        <View style={styles.vehicleTypeRow}>
                          {(['car', 'bike', 'minibus'] as VehicleType[]).map((vehicleType) => (
                            <TouchableOpacity
                              key={vehicleType}
                              style={[
                                styles.vehicleTypeButton,
                                form.vehicleType === vehicleType && styles.vehicleTypeButtonActive,
                              ]}
                              onPress={() => updateForm('vehicleType', vehicleType)}
                            >
                              <Text
                                style={[
                                  styles.vehicleTypeText,
                                  form.vehicleType === vehicleType && styles.vehicleTypeTextActive,
                                ]}
                              >
                                {vehicleType.charAt(0).toUpperCase() + vehicleType.slice(1)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Vehicle Model</Text>
                        <TextInput
                          style={styles.input}
                          value={form.vehicleModel}
                          onChangeText={(value) => updateForm('vehicleModel', value)}
                          placeholder="Toyota Corolla"
                          placeholderTextColor="#9CA3AF"
                        />
                      </View>

                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Plate Number</Text>
                        <TextInput
                          style={styles.input}
                          value={form.vehiclePlateNumber}
                          onChangeText={(value) => updateForm('vehiclePlateNumber', value)}
                          placeholder="LT-123-AB"
                          autoCapitalize="characters"
                          placeholderTextColor="#9CA3AF"
                        />
                      </View>

                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>Vehicle Color</Text>
                        <TextInput
                          style={styles.input}
                          value={form.vehicleColor}
                          onChangeText={(value) => updateForm('vehicleColor', value)}
                          placeholder="Blue"
                          placeholderTextColor="#9CA3AF"
                        />
                      </View>

                      <View style={styles.fieldGroup}>
                        <Text style={styles.fieldLabel}>License Number</Text>
                        <TextInput
                          style={styles.input}
                          value={form.licenseNumber}
                          onChangeText={(value) => updateForm('licenseNumber', value)}
                          placeholder="Optional license number"
                          autoCapitalize="characters"
                          placeholderTextColor="#9CA3AF"
                        />
                      </View>
                    </>
                  ) : null}
                </ScrollView>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity style={styles.cancelButton} onPress={() => setIsEditVisible(false)} disabled={isSaving}>
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveProfile} disabled={isSaving}>
                  {isSaving ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save changes</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal animationType="slide" visible={isHistoryVisible} transparent onRequestClose={() => setIsHistoryVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalWrapper}
          >
            <View style={styles.modalCard}>
              <View style={[styles.modalHeader, isCompactScreen && styles.modalHeaderCompact]}>
                <View style={styles.modalHeaderCopy}>
                  <Text style={styles.modalTitle}>Ride History</Text>
                  <Text style={styles.modalSubtitle}>
                    {isDriver ? 'Review your completed and active driver trips.' : 'Review your recent rides and trip details.'}
                  </Text>
                </View>
                <View style={[styles.historyModalActions, isCompactScreen && styles.historyModalActionsCompact]}>
                  <TouchableOpacity
                    style={styles.refreshIconButton}
                    onPress={() => {
                      void loadRideHistory(true);
                    }}
                  >
                    <Ionicons name="refresh" size={20} color="#0066FF" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.closeIconButton} onPress={() => setIsHistoryVisible(false)}>
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalBody}>
                {isLoadingHistory ? (
                  <View style={styles.historyStateBlock}>
                    <ActivityIndicator size="small" color="#0066FF" />
                    <Text style={styles.loadingText}>Loading your ride history...</Text>
                  </View>
                ) : historyError ? (
                  <View style={styles.historyStateCard}>
                    <Text style={styles.historyStateTitle}>Could not load ride history</Text>
                    <Text style={styles.historyStateText}>{historyError}</Text>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => {
                        void loadRideHistory(true);
                      }}
                    >
                      <Text style={styles.secondaryButtonText}>Try again</Text>
                    </TouchableOpacity>
                  </View>
                ) : rideHistory.length === 0 ? (
                  <View style={styles.historyStateCard}>
                    <Text style={styles.historyStateTitle}>No rides yet</Text>
                    <Text style={styles.historyStateText}>
                      {isDriver
                        ? 'Accepted rides will show up here once you start taking trips.'
                        : 'Your booked rides will appear here after you request or complete a trip.'}
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    style={styles.modalScrollView}
                    contentContainerStyle={styles.modalScrollContent}
                  >
                    {rideHistory.map((ride) => {
                      const statusColor = statusColors[ride.status] || '#6B7280';

                      return (
                        <View key={ride.id} style={styles.rideCard}>
                          <View style={[styles.rideCardHeader, isCompactScreen && styles.rideCardHeaderCompact]}>
                            <Text style={styles.rideRoute}>{getRideRouteLabel(ride)}</Text>
                            <View style={[styles.statusBadge, { backgroundColor: `${statusColor}1A` }]}>
                              <Text style={[styles.statusBadgeText, { color: statusColor }]}>
                                {formatStatusLabel(ride.status)}
                              </Text>
                            </View>
                          </View>

                          <Text style={styles.rideMeta}>{getRideSecondaryLabel(ride, isDriver)}</Text>
                          <Text style={styles.rideMeta}>{formatRideDate(ride)}</Text>

                          <View style={[styles.rideFooter, isCompactScreen && styles.rideFooterCompact]}>
                            <Text style={styles.rideAmount}>{ride.totalFare ?? ride.fare ?? 0} FCFA</Text>
                            <Text style={styles.ridePayment}>
                              Payment: {ride.paymentStatus ? formatStatusLabel(ride.paymentStatus) : 'Pending'}
                            </Text>
                          </View>
                        </View>
                      );
                    })}
                  </ScrollView>
                )}
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        visible={isSettingsVisible}
        transparent
        onRequestClose={() => setIsSettingsVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalWrapper}
          >
            <View style={styles.modalCard}>
              <View style={[styles.modalHeader, isCompactScreen && styles.modalHeaderCompact]}>
                <View style={styles.modalHeaderCopy}>
                  <Text style={styles.modalTitle}>Settings</Text>
                  <Text style={styles.modalSubtitle}>
                    Manage your notifications, privacy preferences, and account security.
                  </Text>
                </View>
                <TouchableOpacity style={styles.closeIconButton} onPress={() => setIsSettingsVisible(false)}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  style={styles.modalScrollView}
                  contentContainerStyle={styles.modalScrollContent}
                >
                  <View style={styles.settingsSection}>
                    <Text style={styles.sectionTitle}>Notifications</Text>
                    <View style={styles.settingRow}>
                      <View style={styles.settingCopy}>
                        <Text style={styles.settingTitle}>Ride updates</Text>
                        <Text style={styles.settingDescription}>Get booking, driver, and trip status alerts.</Text>
                      </View>
                      <Switch
                        value={settingsForm.notifications.rideUpdates}
                        onValueChange={(value) => updateSettingsField('notifications', 'rideUpdates', value)}
                        trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                        thumbColor={settingsForm.notifications.rideUpdates ? '#0066FF' : '#F9FAFB'}
                      />
                    </View>
                    <View style={styles.settingRow}>
                      <View style={styles.settingCopy}>
                        <Text style={styles.settingTitle}>SMS updates</Text>
                        <Text style={styles.settingDescription}>Receive key ride changes by text message too.</Text>
                      </View>
                      <Switch
                        value={settingsForm.notifications.smsUpdates}
                        onValueChange={(value) => updateSettingsField('notifications', 'smsUpdates', value)}
                        trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                        thumbColor={settingsForm.notifications.smsUpdates ? '#0066FF' : '#F9FAFB'}
                      />
                    </View>
                    <View style={styles.settingRow}>
                      <View style={styles.settingCopy}>
                        <Text style={styles.settingTitle}>Promotions</Text>
                        <Text style={styles.settingDescription}>Hear about discounts, rewards, and campaigns.</Text>
                      </View>
                      <Switch
                        value={settingsForm.notifications.promotions}
                        onValueChange={(value) => updateSettingsField('notifications', 'promotions', value)}
                        trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                        thumbColor={settingsForm.notifications.promotions ? '#0066FF' : '#F9FAFB'}
                      />
                    </View>
                  </View>

                  <View style={styles.settingsSection}>
                    <Text style={styles.sectionTitle}>Privacy & Security</Text>
                    <View style={styles.settingRow}>
                      <View style={styles.settingCopy}>
                        <Text style={styles.settingTitle}>Share live location</Text>
                        <Text style={styles.settingDescription}>Let the app share live trip location during rides.</Text>
                      </View>
                      <Switch
                        value={settingsForm.privacy.shareLiveLocation}
                        onValueChange={(value) => updateSettingsField('privacy', 'shareLiveLocation', value)}
                        trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                        thumbColor={settingsForm.privacy.shareLiveLocation ? '#0066FF' : '#F9FAFB'}
                      />
                    </View>
                    <View style={styles.settingRow}>
                      <View style={styles.settingCopy}>
                        <Text style={styles.settingTitle}>Community visibility</Text>
                        <Text style={styles.settingDescription}>Show your public profile details inside communities.</Text>
                      </View>
                      <Switch
                        value={settingsForm.privacy.communityVisibility}
                        onValueChange={(value) => updateSettingsField('privacy', 'communityVisibility', value)}
                        trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                        thumbColor={settingsForm.privacy.communityVisibility ? '#0066FF' : '#F9FAFB'}
                      />
                    </View>
                    <View style={styles.settingRow}>
                      <View style={styles.settingCopy}>
                        <Text style={styles.settingTitle}>Login alerts</Text>
                        <Text style={styles.settingDescription}>Get warned when your account is accessed again.</Text>
                      </View>
                      <Switch
                        value={settingsForm.security.loginAlerts}
                        onValueChange={(value) => updateSettingsField('security', 'loginAlerts', value)}
                        trackColor={{ false: '#D1D5DB', true: '#93C5FD' }}
                        thumbColor={settingsForm.security.loginAlerts ? '#0066FF' : '#F9FAFB'}
                      />
                    </View>
                  </View>

                  <View style={styles.settingsSection}>
                    <Text style={styles.sectionTitle}>Change Password</Text>
                    <Text style={styles.passwordHint}>Confirm your current password first before saving a new one.</Text>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Current Password</Text>
                      <PasswordInput
                        iconColor="#6B7280"
                        inputStyle={styles.input}
                        value={passwordForm.currentPassword}
                        onChangeText={(value) => updatePasswordField('currentPassword', value)}
                        placeholder="Enter current password"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>New Password</Text>
                      <PasswordInput
                        iconColor="#6B7280"
                        inputStyle={styles.input}
                        value={passwordForm.newPassword}
                        onChangeText={(value) => updatePasswordField('newPassword', value)}
                        placeholder="Minimum 6 characters"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>

                    <View style={styles.fieldGroup}>
                      <Text style={styles.fieldLabel}>Confirm New Password</Text>
                      <PasswordInput
                        iconColor="#6B7280"
                        inputStyle={styles.input}
                        value={passwordForm.confirmPassword}
                        onChangeText={(value) => updatePasswordField('confirmPassword', value)}
                        placeholder="Re-enter the new password"
                        placeholderTextColor="#9CA3AF"
                      />
                    </View>
                  </View>
                </ScrollView>
              </View>

              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => setIsSettingsVisible(false)}
                  disabled={isSavingSettings}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.saveButton} onPress={handleSaveSettings} disabled={isSavingSettings}>
                  {isSavingSettings ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save settings</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FB',
  },
  contentContainer: {
    paddingBottom: 24,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#EAF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    overflow: 'hidden',
    position: 'relative',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
  },
  avatarActionButton: {
    position: 'absolute',
    right: 4,
    bottom: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#0066FF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  name: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  phoneNumber: {
    fontSize: 16,
    color: '#4B5563',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  rating: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginLeft: 6,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EEF4FF',
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  editButtonText: {
    color: '#0066FF',
    fontSize: 15,
    fontWeight: '600',
    marginLeft: 8,
  },
  driverCard: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    padding: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  driverInfo: {
    gap: 14,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 16,
    marginLeft: 12,
    color: '#374151',
  },
  emptyDriverState: {
    backgroundColor: '#F8FAFC',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyDriverText: {
    fontSize: 15,
    lineHeight: 22,
    color: '#4B5563',
    marginBottom: 12,
  },
  secondaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF4FF',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: '#0066FF',
    fontWeight: '600',
  },
  walletCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#0066FF',
    borderRadius: 24,
    padding: 22,
  },
  walletLabel: {
    color: '#DCE9FF',
    fontSize: 15,
  },
  balance: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    marginTop: 12,
  },
  addFundsButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  addFundsText: {
    color: '#0066FF',
    fontSize: 16,
    fontWeight: '700',
  },
  historyCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  historyHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  historyHeaderRowCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 12,
  },
  historySummary: {
    color: '#6B7280',
    fontSize: 14,
  },
  historyButton: {
    backgroundColor: '#EEF4FF',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  historyButtonCompact: {
    alignSelf: 'flex-start',
  },
  historyButtonText: {
    color: '#0066FF',
    fontWeight: '600',
  },
  historyPreviewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  historyPreviewText: {
    flex: 1,
    marginLeft: 10,
    color: '#374151',
  },
  menuContainer: {
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  menuTextBlock: {
    flex: 1,
    marginLeft: 14,
    paddingRight: 10,
  },
  menuText: {
    fontSize: 16,
    color: '#111827',
  },
  menuDescription: {
    marginTop: 3,
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 18,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    paddingVertical: 16,
  },
  logoutText: {
    color: '#FF4444',
    fontSize: 16,
    fontWeight: '700',
    marginLeft: 10,
  },
  loadingBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loadingText: {
    color: '#4B5563',
    marginLeft: 8,
  },
  version: {
    textAlign: 'center',
    color: '#9CA3AF',
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(17, 24, 39, 0.45)',
    justifyContent: 'flex-end',
  },
  modalWrapper: {
    maxHeight: '100%',
    width: '100%',
    justifyContent: 'flex-end',
  },
  modalCard: {
    maxHeight: '88%',
    minHeight: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 24,
  },
  modalBody: {
    flexShrink: 1,
    minHeight: 0,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  modalHeaderCompact: {
    gap: 12,
  },
  modalHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
  },
  modalSubtitle: {
    marginTop: 4,
    color: '#6B7280',
    lineHeight: 20,
  },
  closeIconButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalScrollView: {
    flexShrink: 1,
    minHeight: 0,
  },
  modalScrollContent: {
    paddingBottom: 8,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#FFFFFF',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
    marginTop: 8,
  },
  passwordHint: {
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 14,
  },
  vehicleTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  vehicleTypeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  vehicleTypeButtonActive: {
    backgroundColor: '#0066FF',
  },
  vehicleTypeText: {
    color: '#4B5563',
    fontWeight: '600',
  },
  vehicleTypeTextActive: {
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 10,
    flexShrink: 0,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '700',
  },
  saveButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#0066FF',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  historyModalActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  },
  historyModalActionsCompact: {
    alignSelf: 'flex-end',
  },
  refreshIconButton: {
    backgroundColor: '#EEF4FF',
    borderRadius: 999,
    padding: 10,
  },
  historyStateBlock: {
    paddingVertical: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsSection: {
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    gap: 14,
  },
  settingCopy: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  settingDescription: {
    marginTop: 4,
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 18,
  },
  historyStateCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  historyStateTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  historyStateText: {
    color: '#4B5563',
    lineHeight: 22,
    marginBottom: 14,
  },
  rideCard: {
    borderRadius: 18,
    backgroundColor: '#F8FAFC',
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  rideCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 12,
  },
  rideCardHeaderCompact: {
    flexDirection: 'column',
  },
  rideRoute: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  rideMeta: {
    color: '#4B5563',
    marginBottom: 4,
  },
  rideFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  rideFooterCompact: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 6,
  },
  rideAmount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0066FF',
  },
  ridePayment: {
    color: '#6B7280',
    fontSize: 13,
  },
});

export default ProfileScreen;
