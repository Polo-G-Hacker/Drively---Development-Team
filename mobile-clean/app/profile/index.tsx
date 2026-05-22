import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, Stack } from "expo-router";
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
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../../contexts/auth-context';
import { authAPI, driverAPI, passengerAPI, reviewAPI, rideAPI } from '../../services/api/api-client';
import type { DriverProfile, PaymentMethodId, Review, Ride, RideParticipant, User, UserSettings } from '../../types';
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

type ReviewForm = {
  revieweeId: string;
  rating: number;
  comment: string;
};

type PaymentMethodOption = {
  id: Exclude<PaymentMethodId, null>;
  badgeBackground: string;
  badgeShape: 'pill' | 'square';
  badgeText: string;
  badgeTextColor: string;
  subtitle: string;
  title: string;
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

const emptyReviewForm: ReviewForm = {
  revieweeId: '',
  rating: 0,
  comment: '',
};

const paymentMethodOptions: PaymentMethodOption[] = [
  {
    id: 'mtn_momo',
    title: 'MTN Mobile Money',
    subtitle: 'Use your MTN MoMo line for ride payments.',
    badgeText: 'MTN',
    badgeBackground: '#FFD400',
    badgeTextColor: '#0B3A82',
    badgeShape: 'pill',
  },
  {
    id: 'orange_money',
    title: 'Orange Money',
    subtitle: 'Use your Orange Money wallet at checkout.',
    badgeText: 'Orange',
    badgeBackground: '#FF7900',
    badgeTextColor: '#FFFFFF',
    badgeShape: 'square',
  },
];

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
  payments: {
    defaultMethod: null,
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
    payments: {
      ...defaultSettings.payments,
      ...(settings?.payments || {}),
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

function estimateBase64SizeInBytes(value: string) {
  const normalized = value.replace(/=+$/, '');
  return Math.floor((normalized.length * 3) / 4);
}

function validateNativeProfileImage(asset: ImagePicker.ImagePickerAsset) {
  if (!asset.base64) {
    throw new Error('We could not prepare that image for upload. Please try a different photo.');
  }

  const maxBytes = 4 * 1024 * 1024;
  const estimatedBytes = estimateBase64SizeInBytes(asset.base64);

  if (estimatedBytes > maxBytes) {
    throw new Error('Choose an image smaller than 4 MB.');
  }

  return `data:image/jpeg;base64,${asset.base64}`;
}

async function pickProfileImageFromNative() {
  return new Promise<string | null>((resolve) => {
    const handleAction = async (index: number) => {
      try {
        if (index === 0) {
          // Take Photo
          const { status } = await ImagePicker.requestCameraPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Denied', 'We need access to your camera to take a profile photo.');
            resolve(null);
            return;
          }

          const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
            base64: true,
          });

          if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            resolve(validateNativeProfileImage(asset));
          } else {
            resolve(null);
          }
        } else if (index === 1) {
          // Choose from Library
          const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert('Permission Denied', 'We need access to your gallery to upload a profile photo.');
            resolve(null);
            return;
          }

          const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.7,
            base64: true,
          });

          if (!result.canceled && result.assets && result.assets.length > 0) {
            const asset = result.assets[0];
            resolve(validateNativeProfileImage(asset));
          } else {
            resolve(null);
          }
        } else {
          resolve(null);
        }
      } catch (error) {
        console.error('Error picking image:', error);
        Alert.alert('Error', 'An error occurred while picking the image.');
        resolve(null);
      }
    };

    Alert.alert(
      'Profile Photo',
      'Choose an option',
      [
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
        { text: 'Take Photo', onPress: () => handleAction(0) },
        { text: 'Choose from Library', onPress: () => handleAction(1) },
      ],
      { cancelable: true, onDismiss: () => resolve(null) }
    );
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

function formatReviewDate(value?: string | null) {
  if (!value) {
    return 'Recently';
  }

  try {
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  } catch {
    return value;
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

function getDriverUserId(driver: DriverProfile) {
  if (typeof driver.user === 'string') {
    return driver.user;
  }

  return driver.user?.id || driver.user?._id || '';
}

function getDriverName(driver: DriverProfile) {
  if (driver.user && typeof driver.user === 'object' && driver.user.name) {
    return driver.user.name;
  }

  return driver.vehicleModel || 'Driver';
}

function getDriverProfileImage(driver: DriverProfile) {
  if (driver.user && typeof driver.user === 'object') {
    return driver.user.profileImage || null;
  }

  return null;
}

function getDriverDetails(driver: DriverProfile) {
  const parts = [driver.vehicleModel, driver.vehicleColor, driver.vehiclePlateNumber].filter(Boolean);
  return parts.length > 0 ? parts.join(' - ') : 'Driver profile';
}

function getDriverAverageRating(driver: DriverProfile) {
  if (driver.user && typeof driver.user === 'object' && typeof driver.user.rating === 'number') {
    return driver.user.rating;
  }

  return driver.rating ?? 0;
}

function getPaymentMethodLabel(value?: PaymentMethodId) {
  if (value === 'mtn_momo') {
    return 'MTN Mobile Money';
  }

  if (value === 'orange_money') {
    return 'Orange Money';
  }

  return 'Choose MTN or Orange Money';
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
  const [isSupportVisible, setIsSupportVisible] = useState(false);
  const [isAboutVisible, setIsAboutVisible] = useState(false);
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
    const run = async () => {
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

    void run();
  }, [isDriver, user]);

  const driverUser =
    driverProfile && driverProfile.user && typeof driverProfile.user === 'object' ? driverProfile.user : null;
  const displayUser = (isDriver ? driverUser : passengerProfile) || user;
  const displayRating = driverUser?.rating ?? driverProfile?.rating ?? displayUser?.rating ?? 0;
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
  const paymentMethodSummary = useMemo(
    () => getPaymentMethodLabel(mergeSettings(displayUser?.settings).payments.defaultMethod),
    [displayUser?.settings]
  );
  const currentDefaultPaymentMethod = useMemo(
    () => mergeSettings(displayUser?.settings).payments.defaultMethod,
    [displayUser?.settings]
  );

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

  const openSupport = () => {
    setIsSupportVisible(true);
  };

  const openAbout = () => {
    setIsAboutVisible(true);
  };

  const [isPaymentMethodsVisible, setIsPaymentMethodsVisible] = useState(false);
  const [isSavingPaymentMethod, setIsSavingPaymentMethod] = useState(false);
  const [pendingPaymentMethodId, setPendingPaymentMethodId] = useState<Exclude<PaymentMethodId, null> | null>(null);

  const openPaymentMethods = () => {
    setIsPaymentMethodsVisible(true);
  };

  const handleSelectDefaultPaymentMethod = async (method: Exclude<PaymentMethodId, null>) => {
    if (!displayUser || isSavingPaymentMethod) {
      return;
    }

    const currentSettings = mergeSettings(displayUser.settings);
    if (currentSettings.payments.defaultMethod === method) {
      setIsPaymentMethodsVisible(false);
      return;
    }

    setIsSavingPaymentMethod(true);
    setPendingPaymentMethodId(method);

    try {
      const nextSettings: UserSettings = {
        ...currentSettings,
        payments: {
          defaultMethod: method,
        },
      };

      const response = await authAPI.updateSettings(nextSettings);

      if (!response.success || !response.data?.user) {
        showFeedbackAlert('Payment method', response.error || 'Unable to save your default payment method.');
        return;
      }

      setSettingsForm(mergeSettings(response.data.user.settings));
      await applyUserUpdate(response.data.user);
      setIsPaymentMethodsVisible(false);
      showFeedbackAlert('Payment method updated', `${getPaymentMethodLabel(method)} is now your default payment method.`);
    } catch (error) {
      console.error('Error saving default payment method:', error);
      showFeedbackAlert('Payment method', 'Something went wrong while saving your default payment method.');
    } finally {
      setIsSavingPaymentMethod(false);
      setPendingPaymentMethodId(null);
    }
  };

  const handleChangeProfileImage = async () => {
    if (!displayUser) {
      return;
    }

    setIsUploadingImage(true);

    try {
      const profileImage =
        Platform.OS === 'web' ? await pickProfileImageFromBrowser() : await pickProfileImageFromNative();

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

  const [isReviewsVisible, setIsReviewsVisible] = useState(false);
  const [isLoadingReviews, setIsLoadingReviews] = useState(false);
  const [reviewsError, setReviewsError] = useState<string | null>(null);
  const [allDrivers, setAllDrivers] = useState<DriverProfile[]>([]);
  const [myReviews, setMyReviews] = useState<Record<string, Review>>({});
  const [receivedReviews, setReceivedReviews] = useState<Review[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [selectedDriverReviews, setSelectedDriverReviews] = useState<Review[]>([]);
  const [selectedDriverReviewsError, setSelectedDriverReviewsError] = useState<string | null>(null);
  const [isLoadingSelectedDriverReviews, setIsLoadingSelectedDriverReviews] = useState(false);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewForm, setReviewForm] = useState<ReviewForm>(emptyReviewForm);

  function SectionHeader({ title }: { title: string }) {
    return <Text style={styles.sectionHeader}>{title}</Text>;
  }

  const loadReviewsData = async () => {
    setIsLoadingReviews(true);
    setReviewsError(null);

    try {
      if (isDriver) {
        const response = await reviewAPI.getMyReviews();

        if (!response.success || !response.data?.reviews) {
          setReceivedReviews([]);
          setReviewsError(response.error || 'Unable to load your reviews right now.');
          return;
        }

        setReceivedReviews(response.data.reviews);
        return;
      }

      const [driversRes, authoredReviewsRes] = await Promise.all([
        driverAPI.getAllDrivers(),
        reviewAPI.getAuthoredReviews(),
      ]);

      if (!driversRes.success) {
        setAllDrivers([]);
        setReviewsError(driversRes.error || 'Unable to load drivers right now.');
      } else {
        setAllDrivers(driversRes.data?.drivers || []);
      }

      if (!authoredReviewsRes.success) {
        setMyReviews({});
        setReviewsError((current) => current || authoredReviewsRes.error || 'Unable to load your reviews right now.');
      } else {
        const reviewsMap: Record<string, Review> = {};

        for (const review of authoredReviewsRes.data?.reviews || []) {
          if (!review.reviewee) {
            continue;
          }

          const revieweeId = typeof review.reviewee === 'string' ? review.reviewee : review.reviewee.id;
          if (revieweeId) {
            reviewsMap[revieweeId] = review;
          }
        }

        setMyReviews(reviewsMap);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
      setReviewsError('Unable to load reviews data.');
    } finally {
      setIsLoadingReviews(false);
    }
  };

  const loadSelectedDriverReviews = async (driverUserId: string) => {
    setIsLoadingSelectedDriverReviews(true);
    setSelectedDriverReviews([]);
    setSelectedDriverReviewsError(null);

    try {
      const response = await reviewAPI.getUserReviews(driverUserId);

      if (!response.success || !response.data?.reviews) {
        setSelectedDriverReviewsError(response.error || 'Unable to load reviews for this driver.');
        return;
      }

      setSelectedDriverReviews(response.data.reviews);
    } catch (error) {
      console.error('Error loading selected driver reviews:', error);
      setSelectedDriverReviewsError('Unable to load reviews for this driver.');
    } finally {
      setIsLoadingSelectedDriverReviews(false);
    }
  };

  const openReviews = () => {
    setSelectedDriverId(null);
    setSelectedDriverReviews([]);
    setSelectedDriverReviewsError(null);
    setReviewForm(emptyReviewForm);
    setIsReviewsVisible(true);
    void loadReviewsData();
  };

  const closeReviews = () => {
    setIsReviewsVisible(false);
    setSelectedDriverId(null);
    setSelectedDriverReviews([]);
    setSelectedDriverReviewsError(null);
    setReviewForm(emptyReviewForm);
  };

  const handleReviewDriver = (driver: DriverProfile) => {
    const driverUserId = getDriverUserId(driver);
    if (!driverUserId) {
      return;
    }

    if (selectedDriverId === driverUserId) {
      setSelectedDriverId(null);
      setSelectedDriverReviews([]);
      setSelectedDriverReviewsError(null);
      setReviewForm(emptyReviewForm);
      return;
    }

    const existingReview = myReviews[driverUserId];
    setSelectedDriverId(driverUserId);
    setReviewForm({
      revieweeId: driverUserId,
      rating: existingReview?.rating || 0,
      comment: existingReview?.comment || '',
    });

    void loadSelectedDriverReviews(driverUserId);
  };

  const submitReview = async () => {
    if (!reviewForm.revieweeId) {
      showFeedbackAlert('Driver required', 'Choose a driver before saving your review.');
      return;
    }

    if (reviewForm.rating === 0) {
      showFeedbackAlert('Rating required', 'Please select a rating before submitting.');
      return;
    }

    setIsSubmittingReview(true);
    try {
      const revieweeId = reviewForm.revieweeId;
      const existingReview = myReviews[reviewForm.revieweeId];
      let response;

      if (existingReview) {
        response = await reviewAPI.updateReview(existingReview.id, {
          rating: reviewForm.rating,
          comment: reviewForm.comment,
        });
      } else {
        response = await reviewAPI.submitReview({
          revieweeId: reviewForm.revieweeId,
          rating: reviewForm.rating,
          comment: reviewForm.comment,
          rideId: null, // General review
        });
      }

      if (response.success && response.data?.review) {
        const savedReview = response.data.review;

        setMyReviews((prev) => ({
          ...prev,
          [revieweeId]: savedReview,
        }));
        setReviewForm((current) => ({
          ...current,
          revieweeId,
          rating: savedReview.rating || current.rating,
          comment: savedReview.comment || '',
        }));
        await loadSelectedDriverReviews(revieweeId);
        void loadReviewsData();
        showFeedbackAlert(
          existingReview ? 'Review updated' : 'Review added',
          existingReview ? 'Your review has been updated.' : 'Your review has been saved.'
        );
      } else {
        showFeedbackAlert('Error', response.error || 'Failed to save review.');
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      showFeedbackAlert('Error', 'Something went wrong.');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const menuItems: MenuItem[] = [
    {
      icon: 'card-outline',
      title: 'Payment Methods',
      description: paymentMethodSummary,
      onPress: openPaymentMethods,
    },
    {
      icon: 'star-outline',
      title: 'Reviews',
      onPress: openReviews,
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
      description: 'Reach the Drive.ly developers team',
      onPress: openSupport,
    },
    {
      icon: 'information-circle-outline',
      title: 'About',
      description: 'Learn more about Drive.ly',
      onPress: openAbout,
    },
  ];

  return (
    <>
    <Stack.Screen options={{headerShown: false}}></Stack.Screen>
    <View style={styles.headermain}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={"#0066FF"} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

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
          {isDriver ? (
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={20} color="#FFD700" />
              <Text style={styles.rating}>{Number(displayRating).toFixed(1)}</Text>
            </View>
          ) : null}
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
        visible={isPaymentMethodsVisible}
        transparent
        onRequestClose={() => {
          if (!isSavingPaymentMethod) {
            setIsPaymentMethodsVisible(false);
          }
        }}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalWrapper}
          >
            <View style={styles.modalCard}>
              <View style={[styles.modalHeader, isCompactScreen && styles.modalHeaderCompact]}>
                <View style={styles.modalHeaderCopy}>
                  <Text style={styles.modalTitle}>Payment Methods</Text>
                  <Text style={styles.modalSubtitle}>
                    Pick the mobile money network you want selected by default when ride payments go live.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.closeIconButton}
                  onPress={() => setIsPaymentMethodsVisible(false)}
                  disabled={isSavingPaymentMethod}
                >
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={styles.modalScrollView}
                  contentContainerStyle={styles.modalScrollContent}
                >
                  <View style={styles.paymentMethodsList}>
                    {paymentMethodOptions.map((option) => {
                      const isDefault = option.id === currentDefaultPaymentMethod;
                      const isPending = option.id === pendingPaymentMethodId;

                      return (
                        <TouchableOpacity
                          key={option.id}
                          style={[styles.paymentMethodRow, isDefault && styles.paymentMethodRowActive]}
                          onPress={() => {
                            void handleSelectDefaultPaymentMethod(option.id);
                          }}
                          disabled={isSavingPaymentMethod}
                          activeOpacity={0.9}
                        >
                          <View
                            style={[
                              styles.paymentMethodBadge,
                              option.badgeShape === 'pill'
                                ? styles.paymentMethodBadgePill
                                : styles.paymentMethodBadgeSquare,
                              { backgroundColor: option.badgeBackground },
                            ]}
                          >
                            <Text style={[styles.paymentMethodBadgeText, { color: option.badgeTextColor }]}>
                              {option.badgeText}
                            </Text>
                          </View>

                          <View style={styles.paymentMethodCopy}>
                            <Text style={styles.paymentMethodTitle}>{option.title}</Text>
                            <Text style={styles.paymentMethodSubtitle}>{option.subtitle}</Text>
                          </View>

                          <View style={styles.paymentMethodTrailing}>
                            {isSavingPaymentMethod && isPending ? (
                              <ActivityIndicator size="small" color="#0066FF" />
                            ) : isDefault ? (
                              <>
                                <View style={styles.paymentMethodDefaultPill}>
                                  <Text style={styles.paymentMethodDefaultPillText}>Default</Text>
                                </View>
                                <Ionicons name="checkmark-circle" size={22} color="#10B981" />
                              </>
                            ) : (
                              <Ionicons name="ellipse-outline" size={22} color="#9CA3AF" />
                            )}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <View style={styles.paymentMethodNote}>
                    <Ionicons name="information-circle-outline" size={18} color="#0066FF" />
                    <Text style={styles.paymentMethodNoteText}>
                      This saves your preferred network for checkout. Ride charges will use Flutterwave mobile money later.
                    </Text>
                  </View>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal animationType="slide" visible={isSupportVisible} transparent onRequestClose={() => setIsSupportVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalWrapper}
          >
            <View style={styles.modalCard}>
              <View style={[styles.modalHeader, isCompactScreen && styles.modalHeaderCompact]}>
                <View style={styles.modalHeaderCopy}>
                  <Text style={styles.modalTitle}>Help & Support</Text>
                  <Text style={styles.modalSubtitle}>
                    Need a hand? Reach out to the developers team and we will get back to you.
                  </Text>
                </View>
                <TouchableOpacity style={styles.closeIconButton} onPress={() => setIsSupportVisible(false)}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={styles.modalScrollView}
                  contentContainerStyle={styles.modalScrollContent}
                >
                  <View style={styles.supportHeroCard}>
                    <View style={styles.supportIconWrap}>
                      <Ionicons name="headset-outline" size={24} color="#FFFFFF" />
                    </View>
                    <Text style={styles.supportHeroTitle}>Drive.ly Developers Team</Text>
                    <Text style={styles.supportHeroText}>
                      For now, the quickest way to reach support is by email.
                    </Text>
                  </View>

                  <View style={styles.supportContactCard}>
                    <View style={styles.supportContactHeader}>
                      <View style={styles.supportMailBadge}>
                        <Ionicons name="mail-outline" size={22} color="#0066FF" />
                      </View>
                      <View style={styles.supportContactCopy}>
                        <Text style={styles.supportContactLabel}>Developer email</Text>
                        <Text style={styles.supportContactValue}>sobfred30@gmail.com</Text>
                      </View>
                    </View>

                    <Text style={styles.supportFooterText}>
                      Send your questions, bug reports, or feedback and mention Drive.ly in the subject line.
                    </Text>
                  </View>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal animationType="slide" visible={isAboutVisible} transparent onRequestClose={() => setIsAboutVisible(false)}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalWrapper}
          >
            <View style={styles.modalCard}>
              <View style={[styles.modalHeader, isCompactScreen && styles.modalHeaderCompact]}>
                <View style={styles.modalHeaderCopy}>
                  <Text style={styles.modalTitle}>About Drive.ly</Text>
                  <Text style={styles.modalSubtitle}>
                    The full story and product overview will be added here a little later.
                  </Text>
                </View>
                <TouchableOpacity style={styles.closeIconButton} onPress={() => setIsAboutVisible(false)}>
                  <Ionicons name="close" size={24} color="#666" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <ScrollView
                  showsVerticalScrollIndicator={false}
                  style={styles.modalScrollView}
                  contentContainerStyle={styles.modalScrollContent}
                >
                  <View style={styles.aboutHeroCard}>
                    <View style={styles.aboutIconWrap}>
                      <Ionicons name="information-circle-outline" size={26} color="#FFFFFF" />
                    </View>
                    <Text style={styles.aboutHeroTitle}>Drive.ly</Text>
                    <Text style={styles.aboutHeroText}>
                      Move Smart Across Africa.
                    </Text>
                  </View>

                  <View style={styles.aboutCard}>
                    <Text style={styles.aboutCardTitle}>About this section</Text>
                    <Text style={styles.aboutCardText}>
                      This modal is ready for your final company story, mission, values, and product description.
                    </Text>
                    <Text style={styles.aboutCardText}>
                      When you are ready, we can add the complete About Drive.ly content here without changing the layout.
                    </Text>
                  </View>
                </ScrollView>
              </View>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      <Modal animationType="slide" visible={isReviewsVisible} transparent onRequestClose={closeReviews}>
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalWrapper}
          >
            <View style={styles.modalCard}>
              <View style={[styles.modalHeader, isCompactScreen && styles.modalHeaderCompact]}>
                <View style={styles.modalHeaderCopy}>
                  <Text style={styles.modalTitle}>Reviews</Text>
                  <Text style={styles.modalSubtitle}>
                    {isDriver
                      ? 'See the ratings and feedback passengers have left on your profile.'
                      : 'Browse drivers, read passenger feedback, and add or edit your own review.'}
                  </Text>
                </View>
                <View style={[styles.historyModalActions, isCompactScreen && styles.historyModalActionsCompact]}>
                  <TouchableOpacity
                    style={styles.refreshIconButton}
                    onPress={() => {
                      void loadReviewsData();

                      if (selectedDriverId) {
                        void loadSelectedDriverReviews(selectedDriverId);
                      }
                    }}
                  >
                    <Ionicons name="refresh" size={20} color="#0066FF" />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.closeIconButton} onPress={closeReviews}>
                    <Ionicons name="close" size={24} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalBody}>
                {isLoadingReviews ? (
                  <View style={styles.historyStateBlock}>
                    <ActivityIndicator size="small" color="#0066FF" />
                    <Text style={styles.loadingText}>Loading reviews...</Text>
                  </View>
                ) : reviewsError ? (
                  <View style={styles.historyStateCard}>
                    <Text style={styles.historyStateTitle}>Could not load reviews</Text>
                    <Text style={styles.historyStateText}>{reviewsError}</Text>
                    <TouchableOpacity
                      style={styles.secondaryButton}
                      onPress={() => {
                        void loadReviewsData();
                      }}
                    >
                      <Text style={styles.secondaryButtonText}>Try again</Text>
                    </TouchableOpacity>
                  </View>
                ) : isDriver ? (
                  receivedReviews.length === 0 ? (
                    <View style={styles.historyStateCard}>
                      <Text style={styles.historyStateTitle}>No reviews yet</Text>
                      <Text style={styles.historyStateText}>
                        Passenger feedback will show up here after completed trips.
                      </Text>
                    </View>
                  ) : (
                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      style={styles.modalScrollView}
                      contentContainerStyle={styles.modalScrollContent}
                    >
                      <View style={styles.reviewSummaryCard}>
                        <Text style={styles.reviewSummaryLabel}>Passenger rating</Text>
                        <View style={styles.reviewSummaryRow}>
                          <Ionicons name="star" size={20} color="#F59E0B" />
                          <Text style={styles.reviewSummaryValue}>{Number(displayRating).toFixed(1)}</Text>
                          <Text style={styles.reviewSummaryMeta}>
                            {receivedReviews.length} review{receivedReviews.length === 1 ? '' : 's'}
                          </Text>
                        </View>
                      </View>

                      {receivedReviews.map((review) => {
                        const reviewer = typeof review.reviewer === 'object' ? review.reviewer : null;

                        return (
                          <View key={review.id} style={styles.reviewItemCard}>
                            <View style={[styles.reviewItemHeader, isCompactScreen && styles.reviewItemHeaderCompact]}>
                              <View style={styles.reviewItemAuthorRow}>
                                <View style={styles.reviewAvatar}>
                                  {reviewer?.profileImage ? (
                                    <Image source={{ uri: reviewer.profileImage }} style={styles.reviewAvatarImage} />
                                  ) : (
                                    <Ionicons name="person" size={18} color="#0066FF" />
                                  )}
                                </View>
                                <View style={styles.reviewItemAuthorCopy}>
                                  <Text style={styles.reviewItemAuthorName}>{reviewer?.name || 'Passenger'}</Text>
                                  <Text style={styles.reviewItemDate}>{formatReviewDate(review.createdAt)}</Text>
                                </View>
                              </View>

                              <View style={styles.reviewRatingBadge}>
                                <Ionicons name="star" size={14} color="#F59E0B" />
                                <Text style={styles.reviewRatingBadgeText}>{Number(review.rating).toFixed(1)}</Text>
                              </View>
                            </View>

                            <View style={styles.reviewStarsRow}>
                              {[1, 2, 3, 4, 5].map((value) => (
                                <Ionicons
                                  key={`${review.id}-star-${value}`}
                                  name={value <= Math.round(review.rating) ? 'star' : 'star-outline'}
                                  size={16}
                                  color="#F59E0B"
                                />
                              ))}
                            </View>

                            <Text style={review.comment ? styles.reviewItemComment : styles.reviewMutedText}>
                              {review.comment || 'No written feedback provided for this rating.'}
                            </Text>
                          </View>
                        );
                      })}
                    </ScrollView>
                  )
                ) : allDrivers.length === 0 ? (
                  <View style={styles.historyStateCard}>
                    <Text style={styles.historyStateTitle}>No drivers found</Text>
                    <Text style={styles.historyStateText}>
                      Driver profiles will appear here once drivers complete their setup.
                    </Text>
                  </View>
                ) : (
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                    style={styles.modalScrollView}
                    contentContainerStyle={styles.modalScrollContent}
                  >
                    <View style={styles.reviewSummaryCard}>
                      <Text style={styles.reviewSummaryLabel}>Driver directory</Text>
                      <Text style={styles.reviewDirectoryText}>
                        Tap a driver to read passenger feedback and leave your own rating.
                      </Text>
                    </View>

                    {allDrivers.map((driver) => {
                      const driverUserId = getDriverUserId(driver);
                      const existingReview = driverUserId ? myReviews[driverUserId] : undefined;
                      const isSelected = Boolean(driverUserId) && driverUserId === selectedDriverId;
                      const driverImage = getDriverProfileImage(driver);
                      const activeComment =
                        reviewForm.revieweeId === driverUserId ? reviewForm.comment : existingReview?.comment || '';
                      const activeRating =
                        reviewForm.revieweeId === driverUserId ? reviewForm.rating : existingReview?.rating || 0;

                      if (!driverUserId) {
                        return null;
                      }

                      return (
                        <View
                          key={driver.id || driverUserId}
                          style={[styles.reviewDriverCard, isSelected && styles.reviewDriverCardActive]}
                        >
                          <View
                            style={[styles.reviewDriverHeader, isCompactScreen && styles.reviewDriverHeaderCompact]}
                          >
                            <View style={styles.reviewDriverIdentity}>
                              <View style={styles.reviewAvatar}>
                                {driverImage ? (
                                  <Image source={{ uri: driverImage }} style={styles.reviewAvatarImage} />
                                ) : (
                                  <Ionicons name="person" size={20} color="#0066FF" />
                                )}
                              </View>

                              <View style={styles.reviewDriverCopy}>
                                <Text style={styles.reviewDriverName}>{getDriverName(driver)}</Text>
                                <Text style={styles.reviewDriverMeta}>{getDriverDetails(driver)}</Text>
                                <View style={styles.reviewInlineMeta}>
                                  <Ionicons name="star" size={14} color="#F59E0B" />
                                  <Text style={styles.reviewInlineMetaText}>
                                    {Number(getDriverAverageRating(driver)).toFixed(1)}
                                  </Text>
                                </View>
                              </View>
                            </View>

                            <TouchableOpacity
                              style={styles.reviewActionButton}
                              onPress={() => handleReviewDriver(driver)}
                            >
                              <Text style={styles.reviewActionButtonText}>
                                {isSelected ? 'Close' : existingReview ? 'Edit review' : 'Add review'}
                              </Text>
                            </TouchableOpacity>
                          </View>

                          <View style={styles.reviewOwnCard}>
                            <Text style={styles.reviewOwnLabel}>
                              {existingReview ? 'Your latest review' : 'Your review'}
                            </Text>
                            {existingReview ? (
                              <>
                                <View style={styles.reviewStarsRow}>
                                  {[1, 2, 3, 4, 5].map((value) => (
                                    <Ionicons
                                      key={`${existingReview.id}-own-star-${value}`}
                                      name={value <= Math.round(existingReview.rating) ? 'star' : 'star-outline'}
                                      size={15}
                                      color="#F59E0B"
                                    />
                                  ))}
                                  <Text style={styles.reviewOwnDate}>{formatReviewDate(existingReview.createdAt)}</Text>
                                </View>
                                <Text style={styles.reviewOwnComment}>
                                  {existingReview.comment || 'You rated this driver without a written comment.'}
                                </Text>
                              </>
                            ) : (
                              <Text style={styles.reviewMutedText}>You have not reviewed this driver yet.</Text>
                            )}
                          </View>

                          {isSelected ? (
                            <View style={styles.reviewExpandedPanel}>
                              <Text style={styles.reviewSectionHeading}>
                                {existingReview
                                  ? `Edit your review for ${getDriverName(driver)}`
                                  : `Rate ${getDriverName(driver)}`}
                              </Text>
                              <Text style={styles.reviewSectionHint}>
                                Choose a rating and add a short note if you want.
                              </Text>

                              <View style={styles.reviewComposerStars}>
                                {[1, 2, 3, 4, 5].map((value) => (
                                  <TouchableOpacity
                                    key={`${driverUserId}-composer-star-${value}`}
                                    style={styles.reviewStarButton}
                                    onPress={() =>
                                      setReviewForm((current) => ({
                                        ...current,
                                        revieweeId: driverUserId,
                                        rating: value,
                                      }))
                                    }
                                  >
                                    <Ionicons
                                      name={value <= activeRating ? 'star' : 'star-outline'}
                                      size={28}
                                      color="#F59E0B"
                                    />
                                  </TouchableOpacity>
                                ))}
                              </View>

                              <TextInput
                                style={[styles.input, styles.reviewCommentInput]}
                                value={activeComment}
                                onChangeText={(value) =>
                                  setReviewForm((current) => ({
                                    ...current,
                                    revieweeId: driverUserId,
                                    comment: value,
                                  }))
                                }
                                placeholder="Share a quick note about the ride experience"
                                placeholderTextColor="#9CA3AF"
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                                maxLength={280}
                              />
                              <Text style={styles.reviewCharacterHint}>{activeComment.length}/280</Text>

                              <TouchableOpacity
                                style={[styles.saveButton, styles.reviewSubmitButton]}
                                onPress={() => {
                                  void submitReview();
                                }}
                                disabled={isSubmittingReview}
                              >
                                {isSubmittingReview ? (
                                  <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                  <Text style={styles.saveButtonText}>
                                    {existingReview ? 'Update review' : 'Save review'}
                                  </Text>
                                )}
                              </TouchableOpacity>

                              <View style={styles.reviewDivider} />

                              <Text style={styles.reviewSectionHeading}>Recent passenger feedback</Text>
                              {isLoadingSelectedDriverReviews ? (
                                <View style={styles.historyStateBlock}>
                                  <ActivityIndicator size="small" color="#0066FF" />
                                  <Text style={styles.loadingText}>Loading driver feedback...</Text>
                                </View>
                              ) : selectedDriverReviewsError ? (
                                <Text style={styles.reviewErrorText}>{selectedDriverReviewsError}</Text>
                              ) : selectedDriverReviews.length === 0 ? (
                                <Text style={styles.reviewMutedText}>
                                  No passenger feedback has been published for this driver yet.
                                </Text>
                              ) : (
                                selectedDriverReviews.map((review) => {
                                  const reviewer = typeof review.reviewer === 'object' ? review.reviewer : null;

                                  return (
                                    <View key={review.id} style={styles.reviewItemCard}>
                                      <View
                                        style={[
                                          styles.reviewItemHeader,
                                          isCompactScreen && styles.reviewItemHeaderCompact,
                                        ]}
                                      >
                                        <View style={styles.reviewItemAuthorRow}>
                                          <View style={styles.reviewAvatar}>
                                            {reviewer?.profileImage ? (
                                              <Image
                                                source={{ uri: reviewer.profileImage }}
                                                style={styles.reviewAvatarImage}
                                              />
                                            ) : (
                                              <Ionicons name="person" size={18} color="#0066FF" />
                                            )}
                                          </View>
                                          <View style={styles.reviewItemAuthorCopy}>
                                            <Text style={styles.reviewItemAuthorName}>
                                              {reviewer?.name || 'Passenger'}
                                            </Text>
                                            <Text style={styles.reviewItemDate}>
                                              {formatReviewDate(review.createdAt)}
                                            </Text>
                                          </View>
                                        </View>

                                        <View style={styles.reviewRatingBadge}>
                                          <Ionicons name="star" size={14} color="#F59E0B" />
                                          <Text style={styles.reviewRatingBadgeText}>
                                            {Number(review.rating).toFixed(1)}
                                          </Text>
                                        </View>
                                      </View>

                                      <View style={styles.reviewStarsRow}>
                                        {[1, 2, 3, 4, 5].map((value) => (
                                          <Ionicons
                                            key={`${review.id}-selected-star-${value}`}
                                            name={value <= Math.round(review.rating) ? 'star' : 'star-outline'}
                                            size={16}
                                            color="#F59E0B"
                                          />
                                        ))}
                                      </View>

                                      <Text style={review.comment ? styles.reviewItemComment : styles.reviewMutedText}>
                                        {review.comment || 'No written feedback provided for this rating.'}
                                      </Text>
                                    </View>
                                  );
                                })
                              )}
                            </View>
                          ) : null}
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
    backgroundColor: "#F5F7FB",
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: "700",
    color: "#fffff",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginLeft: 16,
    marginBottom: 8,
    marginTop: 16,
  },
  contentContainer: {
    paddingBottom: 24,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "",
    justifyContent: "center",
    alignItems: "center",
  },
  headermain: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 56,
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: "#ffffff",
  },
  header: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 24,
    paddingTop: 32,
    paddingBottom: 24,
    alignItems: "center",
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#0066FF" },

  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#EAF2FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
    overflow: "hidden",
    position: "relative",
  },
  avatarImage: {
    width: "100%",
    height: "100%",
  },
  avatarActionButton: {
    position: "absolute",
    right: 4,
    bottom: 4,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0066FF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  name: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 4,
  },
  phoneNumber: {
    fontSize: 16,
    color: "#4B5563",
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  rating: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginLeft: 6,
  },
  editButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#EEF4FF",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  editButtonText: {
    color: "#0066FF",
    fontSize: 15,
    fontWeight: "600",
    marginLeft: 8,
  },
  driverCard: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    padding: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  driverInfo: {
    gap: 14,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoText: {
    fontSize: 16,
    marginLeft: 12,
    color: "#374151",
  },
  emptyDriverState: {
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  emptyDriverText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#4B5563",
    marginBottom: 12,
  },
  secondaryButton: {
    alignSelf: "flex-start",
    backgroundColor: "#EEF4FF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
  },
  secondaryButtonText: {
    color: "#0066FF",
    fontWeight: "600",
  },
  historyCard: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 20,
  },
  historyHeaderCopy: {
    flex: 1,
    paddingRight: 12,
  },
  historyHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  historyHeaderRowCompact: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 12,
  },
  historySummary: {
    color: "#6B7280",
    fontSize: 14,
  },
  historyButton: {
    backgroundColor: "#EEF4FF",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  historyButtonCompact: {
    alignSelf: "flex-start",
  },
  historyButtonText: {
    color: "#0066FF",
    fontWeight: "600",
  },
  historyPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  historyPreviewText: {
    flex: 1,
    marginLeft: 10,
    color: "#374151",
  },
  menuContainer: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 20,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  menuTextBlock: {
    flex: 1,
    marginLeft: 14,
    paddingRight: 10,
  },
  menuText: {
    fontSize: 16,
    color: "#111827",
  },
  menuDescription: {
    marginTop: 3,
    color: "#6B7280",
    fontSize: 12,
    lineHeight: 18,
  },
  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    paddingVertical: 16,
  },
  logoutText: {
    color: "#FF4444",
    fontSize: 16,
    fontWeight: "700",
    marginLeft: 10,
  },
  loadingBlock: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  loadingText: {
    color: "#4B5563",
    marginLeft: 8,
  },
  version: {
    textAlign: "center",
    color: "#9CA3AF",
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.45)",
    justifyContent: "flex-end",
  },
  modalWrapper: {
    maxHeight: "100%",
    width: "100%",
    justifyContent: "flex-end",
  },
  modalCard: {
    maxHeight: "88%",
    minHeight: 0,
    backgroundColor: "#FFFFFF",
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
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
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
    fontWeight: "700",
    color: "#111827",
  },
  modalSubtitle: {
    marginTop: 4,
    color: "#6B7280",
    lineHeight: 20,
  },
  closeIconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  modalScrollView: {
    flexShrink: 1,
    minHeight: 0,
  },
  modalScrollContent: {
    paddingBottom: 28,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#374151",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: "#111827",
    backgroundColor: "#FFFFFF",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
    marginTop: 8,
  },
  passwordHint: {
    color: "#6B7280",
    lineHeight: 20,
    marginBottom: 14,
  },
  vehicleTypeRow: {
    flexDirection: "row",
    gap: 10,
  },
  vehicleTypeButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
  },
  vehicleTypeButtonActive: {
    backgroundColor: "#0066FF",
  },
  vehicleTypeText: {
    color: "#4B5563",
    fontWeight: "600",
  },
  vehicleTypeTextActive: {
    color: "#FFFFFF",
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10,
    flexShrink: 0,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#F3F4F6",
  },
  cancelButtonText: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "700",
  },
  saveButton: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#0066FF",
  },
  saveButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },
  historyModalActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexShrink: 0,
  },
  historyModalActionsCompact: {
    alignSelf: "flex-end",
  },
  refreshIconButton: {
    backgroundColor: "#EEF4FF",
    borderRadius: 999,
    padding: 10,
  },
  historyStateBlock: {
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  settingsSection: {
    marginBottom: 20,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
    gap: 14,
  },
  settingCopy: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#111827",
  },
  settingDescription: {
    marginTop: 4,
    color: "#6B7280",
    fontSize: 13,
    lineHeight: 18,
  },
  historyStateCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  historyStateTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
  },
  historyStateText: {
    color: "#4B5563",
    lineHeight: 22,
    marginBottom: 14,
  },
  rideCard: {
    borderRadius: 18,
    backgroundColor: "#F8FAFC",
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  rideCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
    gap: 12,
  },
  rideCardHeaderCompact: {
    flexDirection: "column",
  },
  rideRoute: {
    flex: 1,
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  rideMeta: {
    color: "#4B5563",
    marginBottom: 4,
  },
  rideFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  rideFooterCompact: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 6,
  },
  rideAmount: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0066FF",
  },
  ridePayment: {
    color: "#6B7280",
    fontSize: 13,
  },
  paymentMethodsList: {
    gap: 12,
  },
  paymentMethodRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
  },
  paymentMethodRowActive: {
    borderColor: "#93C5FD",
    backgroundColor: "#F8FBFF",
  },
  paymentMethodBadge: {
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
    overflow: "hidden",
  },
  paymentMethodBadgePill: {
    width: 58,
    height: 40,
    borderRadius: 999,
  },
  paymentMethodBadgeSquare: {
    width: 52,
    height: 52,
    borderRadius: 14,
  },
  paymentMethodBadgeText: {
    fontSize: 13,
    fontWeight: "800",
  },
  paymentMethodCopy: {
    flex: 1,
    paddingRight: 12,
  },
  paymentMethodTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  paymentMethodSubtitle: {
    marginTop: 4,
    color: "#6B7280",
    lineHeight: 19,
  },
  paymentMethodTrailing: {
    alignItems: "flex-end",
    justifyContent: "center",
    gap: 8,
  },
  paymentMethodDefaultPill: {
    backgroundColor: "#E0F2FE",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: 6,
  },
  paymentMethodDefaultPillText: {
    color: "#0369A1",
    fontSize: 11,
    fontWeight: "700",
  },
  paymentMethodNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 18,
    marginBottom: 8,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#EFF6FF",
  },
  paymentMethodNoteText: {
    flex: 1,
    color: "#1E3A8A",
    lineHeight: 20,
  },
  supportHeroCard: {
    borderRadius: 22,
    padding: 22,
    backgroundColor: "#0066FF",
  },
  supportIconWrap: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  supportHeroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  supportHeroText: {
    marginTop: 8,
    color: "#DCE9FF",
    lineHeight: 22,
  },
  supportContactCard: {
    marginTop: 16,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F8FAFC",
  },
  supportContactHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  supportMailBadge: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  supportContactCopy: {
    flex: 1,
    minWidth: 0,
  },
  supportContactLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  supportContactValue: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    lineHeight: 22,
    flexShrink: 1,
  },
  supportFooterText: {
    marginTop: 16,
    color: "#4B5563",
    lineHeight: 21,
  },
  aboutHeroCard: {
    borderRadius: 22,
    padding: 22,
    backgroundColor: "#111827",
  },
  aboutIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.14)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  aboutHeroTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  aboutHeroText: {
    marginTop: 8,
    color: "#D1D5DB",
    lineHeight: 22,
  },
  aboutCard: {
    marginTop: 16,
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F8FAFC",
  },
  aboutCardTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 10,
  },
  aboutCardText: {
    color: "#4B5563",
    lineHeight: 21,
    marginBottom: 10,
  },
  reviewSummaryCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 14,
  },
  reviewSummaryLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  reviewSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  reviewSummaryValue: {
    fontSize: 24,
    fontWeight: "800",
    color: "#111827",
  },
  reviewSummaryMeta: {
    color: "#4B5563",
    fontSize: 14,
  },
  reviewDirectoryText: {
    color: "#4B5563",
    lineHeight: 20,
  },
  reviewDriverCard: {
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  reviewDriverCardActive: {
    borderColor: "#93C5FD",
    backgroundColor: "#F8FBFF",
  },
  reviewDriverHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  reviewDriverHeaderCompact: {
    flexDirection: "column",
  },
  reviewDriverIdentity: {
    flexDirection: "row",
    flex: 1,
    alignItems: "center",
  },
  reviewDriverCopy: {
    flex: 1,
    marginLeft: 12,
  },
  reviewDriverName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  reviewDriverMeta: {
    color: "#4B5563",
    marginTop: 4,
    lineHeight: 20,
  },
  reviewInlineMeta: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  reviewInlineMetaText: {
    color: "#374151",
    marginLeft: 6,
    fontWeight: "600",
  },
  reviewActionButton: {
    backgroundColor: "#EEF4FF",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  reviewActionButtonText: {
    color: "#0066FF",
    fontWeight: "700",
  },
  reviewAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#EAF2FF",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  reviewAvatarImage: {
    width: "100%",
    height: "100%",
  },
  reviewOwnCard: {
    marginTop: 14,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
  },
  reviewOwnLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#374151",
    marginBottom: 8,
  },
  reviewOwnDate: {
    color: "#6B7280",
    fontSize: 12,
    marginLeft: 10,
  },
  reviewOwnComment: {
    color: "#374151",
    lineHeight: 20,
    marginTop: 8,
  },
  reviewExpandedPanel: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#DBEAFE",
  },
  reviewSectionHeading: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },
  reviewSectionHint: {
    color: "#6B7280",
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 12,
  },
  reviewComposerStars: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  reviewStarButton: {
    marginRight: 8,
  },
  reviewCommentInput: {
    minHeight: 112,
    paddingTop: 14,
  },
  reviewCharacterHint: {
    alignSelf: "flex-end",
    color: "#6B7280",
    fontSize: 12,
    marginTop: 8,
  },
  reviewSubmitButton: {
    flex: 0,
    marginTop: 12,
  },
  reviewDivider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginVertical: 18,
  },
  reviewErrorText: {
    color: "#B91C1C",
    lineHeight: 20,
  },
  reviewItemCard: {
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  reviewItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  reviewItemHeaderCompact: {
    flexDirection: "column",
  },
  reviewItemAuthorRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  reviewItemAuthorCopy: {
    flex: 1,
    marginLeft: 12,
  },
  reviewItemAuthorName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
  },
  reviewItemDate: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 3,
  },
  reviewRatingBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF7ED",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  reviewRatingBadgeText: {
    color: "#C2410C",
    fontWeight: "700",
    marginLeft: 6,
  },
  reviewStarsRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 12,
  },
  reviewItemComment: {
    color: "#374151",
    lineHeight: 21,
    marginTop: 10,
  },
  reviewMutedText: {
    color: "#6B7280",
    lineHeight: 20,
    marginTop: 8,
  },
});

export default ProfileScreen;
