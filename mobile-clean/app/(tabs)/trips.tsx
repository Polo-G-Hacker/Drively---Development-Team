import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/auth-context';
import { rideAPI } from '../../services/api/api-client';
import type { DriverProfile, Ride, RideParticipant } from '../../types';

type TripFilter = 'all' | 'active' | 'completed' | 'cancelled';

const tripFilters: { key: TripFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'active', label: 'Active' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

const defaultStatusStyle = {
  color: '#475569',
  background: '#E2E8F0',
};

const statusStyles: Record<string, { color: string; background: string }> = {
  active: {
    color: '#0369A1',
    background: '#E0F2FE',
  },
  searching: {
    color: '#B45309',
    background: '#FEF3C7',
  },
  completed: {
    color: '#047857',
    background: '#D1FAE5',
  },
  cancelled: {
    color: '#B91C1C',
    background: '#FEE2E2',
  },
  accepted: {
    color: '#1D4ED8',
    background: '#DBEAFE',
  },
  requested: {
    color: '#6D28D9',
    background: '#EDE9FE',
  },
  in_progress: {
    color: '#0F766E',
    background: '#CCFBF1',
  },
};

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
      return `${ride.passengers?.length || 0} passengers on this route`;
    }

    if (passengerNames.length === 1) {
      return `Passenger: ${passengerNames[0]}`;
    }

    return `${passengerNames.length} passengers - ${passengerNames[0]} +${passengerNames.length - 1}`;
  }

  if (ride.driver && typeof ride.driver === 'object') {
    const driver = ride.driver as DriverProfile;
    const driverUser = driver.user && typeof driver.user === 'object' ? driver.user : null;
    const baseLabel = driverUser?.name || driver.vehicleModel || 'Driver assigned';
    const vehicleBits = [driver.vehicleModel, driver.vehiclePlateNumber].filter(Boolean).join(' - ');
    return vehicleBits ? `${baseLabel} - ${vehicleBits}` : baseLabel;
  }

  return 'Driver details unavailable';
}

function getPassengerFareForUser(ride: Ride, userId?: string | null) {
  if (!userId) {
    return null;
  }

  const matchingPassenger = (ride.passengers || []).find((passenger) => {
    if (!passenger.user) {
      return false;
    }

    if (typeof passenger.user === 'string') {
      return passenger.user === userId;
    }

    return passenger.user.id === userId || passenger.user._id === userId;
  });

  return matchingPassenger?.fare ?? null;
}

function getRideAmount(ride: Ride, userId: string | null, isDriver: boolean) {
  if (isDriver) {
    return ride.driverEarnings ?? ride.totalFare ?? ride.fare ?? 0;
  }

  return getPassengerFareForUser(ride, userId) ?? ride.fare ?? ride.totalFare ?? 0;
}

function formatFcfa(amount: number) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `${safeAmount.toLocaleString('en-US')} FCFA`;
}

function matchesTripFilter(ride: Ride, filter: TripFilter) {
  switch (filter) {
    case 'active':
      return ['active', 'accepted', 'requested', 'searching', 'in_progress'].includes(ride.status);
    case 'completed':
      return ride.status === 'completed';
    case 'cancelled':
      return ride.status === 'cancelled';
    case 'all':
    default:
      return true;
  }
}

export default function TripsScreen() {
  const { focus, jump } = useLocalSearchParams<{ focus?: string; jump?: string }>();
  const { user } = useAuth();
  const isDriver = user?.role === 'driver';
  const userId = user?.id || user?._id || null;
  const scrollViewRef = useRef<ScrollView | null>(null);
  const [rides, setRides] = useState<Ride[]>([]);
  const [activeFilter, setActiveFilter] = useState<TripFilter>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recentActivityOffset, setRecentActivityOffset] = useState(0);

  useEffect(() => {
    void loadRideHistory();
  }, []);

  const loadRideHistory = async ({ silent = false } = {}) => {
    if (silent) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const response = await rideAPI.getRideHistory();

      if (!response.success || !response.data?.rides) {
        setError(response.error || 'Unable to load trip history right now.');
        return;
      }

      setRides(response.data.rides);
      setError(null);
    } catch (loadError) {
      console.error('Error loading ride history:', loadError);
      setError('Unable to load trip history right now.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const filteredRides = useMemo(
    () => rides.filter((ride) => matchesTripFilter(ride, activeFilter)),
    [activeFilter, rides]
  );

  const latestRouteLabel = rides[0]
    ? getRideRouteLabel(rides[0])
    : isDriver
      ? 'Your next accepted route will appear here.'
      : 'Your next booked ride will appear here.';

  const completedCount = useMemo(
    () => rides.filter((ride) => ride.status === 'completed').length,
    [rides]
  );

  const activeCount = useMemo(
    () => rides.filter((ride) => matchesTripFilter(ride, 'active')).length,
    [rides]
  );

  const totalAmount = useMemo(
    () => rides.reduce((sum, ride) => sum + getRideAmount(ride, userId, isDriver), 0),
    [isDriver, rides, userId]
  );

  const emptyTitle = rides.length === 0
    ? isDriver
      ? 'No rides recorded yet'
      : 'No trips recorded yet'
    : `No ${tripFilters.find((filter) => filter.key === activeFilter)?.label.toLowerCase()} trips`;

  const emptyCopy = rides.length === 0
    ? isDriver
      ? 'Accepted rides and completed routes will show here once you start driving.'
      : 'Requested and completed rides will show here once you start booking routes.'
    : 'Try another filter or pull down to refresh the history.';

  useEffect(() => {
    if (focus !== 'recent' || recentActivityOffset <= 0) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(recentActivityOffset - 12, 0),
        animated: true,
      });
    });

    return () => cancelAnimationFrame(frameId);
  }, [focus, jump, recentActivityOffset]);

  return (
    <View style={styles.screen}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => void loadRideHistory({ silent: true })} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Ionicons name="receipt-outline" size={16} color="#0B63F6" />
            <Text style={styles.heroBadgeText}>Trips</Text>
          </View>

          <Text style={styles.heroTitle}>
            {isDriver ? 'Keep every ride and earning in view' : 'Keep every ride and fare in one place'}
          </Text>
          <Text style={styles.heroSubtitle}>
            {isDriver
              ? 'This tab gives drivers a direct history of accepted routes, live activity, and revenue.'
              : 'This tab gives passengers a direct history of booked rides, live requests, and what each route cost.'}
          </Text>

          <View style={styles.routePreview}>
            <View style={styles.routeIcon}>
              <Ionicons name="swap-horizontal" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.routeCopy}>
              <Text style={styles.routeEyebrow}>Latest route</Text>
              <Text style={styles.routeText}>{latestRouteLabel}</Text>
            </View>
          </View>

          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{rides.length}</Text>
              <Text style={styles.summaryLabel}>Total</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{completedCount}</Text>
              <Text style={styles.summaryLabel}>Completed</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{activeCount}</Text>
              <Text style={styles.summaryLabel}>Active</Text>
            </View>
          </View>

          <View style={styles.amountStrip}>
            <Text style={styles.amountStripLabel}>{isDriver ? 'Total earned' : 'Total spent'}</Text>
            <Text style={styles.amountStripValue}>{formatFcfa(totalAmount)}</Text>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {tripFilters.map((filter) => {
            const isActive = filter.key === activeFilter;

            return (
              <TouchableOpacity
                key={filter.key}
                style={[styles.filterChip, isActive && styles.filterChipActive]}
                onPress={() => setActiveFilter(filter.key)}
                activeOpacity={0.85}
              >
                <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{filter.label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <View
          style={styles.sectionHeader}
          onLayout={(event) => {
            setRecentActivityOffset(event.nativeEvent.layout.y);
          }}
        >
          <View>
            <Text style={styles.sectionTitle}>Recent activity</Text>
            <Text style={styles.sectionSubtitle}>
              {filteredRides.length} {filteredRides.length === 1 ? 'trip' : 'trips'} shown
            </Text>
          </View>
          <TouchableOpacity
            style={styles.refreshButton}
            onPress={() => void loadRideHistory({ silent: true })}
            activeOpacity={0.85}
          >
            <Ionicons name="refresh" size={16} color="#0B63F6" />
            <Text style={styles.refreshButtonText}>Refresh</Text>
          </TouchableOpacity>
        </View>

        {error ? (
          <View style={styles.errorBanner}>
            <View style={styles.errorCopy}>
              <Ionicons name="alert-circle-outline" size={18} color="#B91C1C" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
            <TouchableOpacity onPress={() => void loadRideHistory()} activeOpacity={0.85}>
              <Text style={styles.errorAction}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {isLoading && rides.length === 0 ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color="#0B63F6" />
            <Text style={styles.loadingText}>Loading trip history...</Text>
          </View>
        ) : filteredRides.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="car-sport-outline" size={24} color="#0B63F6" />
            </View>
            <Text style={styles.emptyTitle}>{emptyTitle}</Text>
            <Text style={styles.emptyCopy}>{emptyCopy}</Text>
          </View>
        ) : (
          filteredRides.map((ride) => {
            const statusStyle = statusStyles[ride.status] || defaultStatusStyle;

            return (
              <View key={ride.id} style={styles.tripCard}>
                <View style={styles.tripHeader}>
                  <View style={styles.tripHeaderLeft}>
                    <View style={styles.tripMarker}>
                      <Ionicons
                        name={isDriver ? 'car-outline' : 'navigate-outline'}
                        size={18}
                        color="#0B63F6"
                      />
                    </View>
                    <View style={styles.tripHeaderCopy}>
                      <Text style={styles.tripRoute}>{getRideRouteLabel(ride)}</Text>
                      <Text style={styles.tripMeta}>{getRideSecondaryLabel(ride, isDriver)}</Text>
                    </View>
                  </View>

                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.background }]}>
                    <Text style={[styles.statusBadgeText, { color: statusStyle.color }]}>
                      {formatStatusLabel(ride.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.tripInfoRow}>
                  <Text style={styles.tripDate}>{formatRideDate(ride)}</Text>
                  {ride.community ? (
                    <View style={styles.communityTag}>
                      <Ionicons name="people-outline" size={14} color="#2563EB" />
                      <Text style={styles.communityTagText}>Community ride</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.tripFooter}>
                  <View>
                    <Text style={styles.tripAmountLabel}>{isDriver ? 'Driver earnings' : 'Ride fare'}</Text>
                    <Text style={styles.tripAmount}>{formatFcfa(getRideAmount(ride, userId, isDriver))}</Text>
                  </View>
                  <Text style={styles.tripPayment}>
                    Payment: {ride.paymentStatus ? formatStatusLabel(ride.paymentStatus) : 'Pending'}
                  </Text>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F3F6FB',
  },
  content: {
    paddingHorizontal: 18,
    paddingTop: 24,
    paddingBottom: 120,
  },
  heroCard: {
    backgroundColor: '#0F172A',
    borderRadius: 28,
    padding: 22,
    marginBottom: 18,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E0E7FF',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 18,
  },
  heroBadgeText: {
    color: '#0B63F6',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 32,
  },
  heroSubtitle: {
    color: '#CBD5E1',
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
  },
  routePreview: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 18,
    padding: 16,
    borderRadius: 22,
    backgroundColor: '#1E293B',
  },
  routeIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0B63F6',
    marginRight: 12,
  },
  routeCopy: {
    flex: 1,
  },
  routeEyebrow: {
    color: '#93C5FD',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  routeText: {
    color: '#F8FAFC',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 21,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 12,
    backgroundColor: '#1E293B',
  },
  summaryValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  summaryLabel: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  amountStrip: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#334155',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountStripLabel: {
    color: '#CBD5E1',
    fontSize: 14,
    fontWeight: '600',
  },
  amountStripValue: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  filterRow: {
    paddingBottom: 10,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    marginRight: 10,
  },
  filterChipActive: {
    backgroundColor: '#0B63F6',
  },
  filterChipText: {
    color: '#1E293B',
    fontSize: 14,
    fontWeight: '700',
  },
  filterChipTextActive: {
    color: '#FFFFFF',
  },
  sectionHeader: {
    marginTop: 10,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: '#0F172A',
    fontSize: 22,
    fontWeight: '800',
  },
  sectionSubtitle: {
    marginTop: 4,
    color: '#64748B',
    fontSize: 13,
    fontWeight: '500',
  },
  refreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: '#DBEAFE',
  },
  refreshButtonText: {
    color: '#0B63F6',
    fontSize: 13,
    fontWeight: '700',
  },
  errorBanner: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 20,
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#FECACA',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  errorCopy: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    flex: 1,
    color: '#991B1B',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
  },
  errorAction: {
    color: '#B91C1C',
    fontSize: 13,
    fontWeight: '800',
  },
  loadingState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  loadingText: {
    marginTop: 14,
    color: '#475569',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 40,
    paddingHorizontal: 24,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#DBEAFE',
    marginBottom: 16,
  },
  emptyTitle: {
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyCopy: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    marginBottom: 14,
  },
  tripHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  tripHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tripMarker: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EFF6FF',
    marginRight: 12,
  },
  tripHeaderCopy: {
    flex: 1,
  },
  tripRoute: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  tripMeta: {
    marginTop: 6,
    color: '#64748B',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  tripInfoRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  tripDate: {
    flex: 1,
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
  },
  communityTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
  },
  communityTagText: {
    color: '#2563EB',
    fontSize: 12,
    fontWeight: '700',
  },
  tripFooter: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 12,
  },
  tripAmountLabel: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  tripAmount: {
    marginTop: 4,
    color: '#0F172A',
    fontSize: 19,
    fontWeight: '800',
  },
  tripPayment: {
    color: '#475569',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'right',
  },
});
