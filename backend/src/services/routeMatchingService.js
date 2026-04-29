const User = require('../models/User');
const Driver = require('../models/Driver');
const Ride = require('../models/Ride');
const { Client } = require('@googlemaps/google-maps-services-js');

const googleMapsClient = new Client({});

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) *
    Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // Distance in meters
}

/**
 * Calculate direction similarity between two routes
 */
function calculateDirectionSimilarity(origin1, dest1, origin2, dest2) {
  const angle1 = Math.atan2(dest1[1] - origin1[1], dest1[0] - origin1[0]);
  const angle2 = Math.atan2(dest2[1] - origin2[1], dest2[0] - origin2[0]);
  
  const angleDiff = Math.abs(angle1 - angle2);
  const similarity = 1 - (angleDiff / Math.PI);
  
  return similarity;
}

/**
 * Calculate fare based on distance and time
 */
function calculateFare(distance, duration) {
  const pricePerKm = 200; // FCFA per km (adjust based on location)
  const pricePerMinute = 10; // FCFA per minute
  
  const distanceCost = (distance / 1000) * pricePerKm;
  const timeCost = (duration / 60) * pricePerMinute;
  
  return Math.round(distanceCost + timeCost);
}

/**
 * Match passengers with drivers based on route similarity
 */
async function matchRoute({ originCoords, destinationCoords, maxDetour = 2000 }) {
  try {
    // Find available drivers with active routes
    const drivers = await Driver.find({
      isAvailable: true,
      'currentRoute.originCoords': { $exists: true },
      'currentRoute.destinationCoords': { $exists: true }
    }).populate('user');

    const matches = [];

    for (const driver of drivers) {
      const driverOrigin = driver.currentRoute.originCoords.coordinates;
      const driverDest = driver.currentRoute.destinationCoords.coordinates;

      // Check if driver has space
      if (driver.currentPassengerCount >= driver.maxPassengers) {
        continue;
      }

      // Calculate distances
      const pickupDistance = calculateDistance(
        originCoords[1], originCoords[0],
        driverOrigin[1], driverOrigin[0]
      );

      const dropoffDistance = calculateDistance(
        destinationCoords[1], destinationCoords[0],
        driverDest[1], driverDest[0]
      );

      // Calculate direction similarity
      const directionSimilarity = calculateDirectionSimilarity(
        originCoords, destinationCoords,
        driverOrigin, driverDest
      );

      // Calculate detour
      const detour = pickupDistance + dropoffDistance;

      // Check if match is valid
      if (detour <= maxDetour && directionSimilarity > 0.5) {
        // Get route details from Google Maps
        try {
          const routeResponse = await googleMapsClient.directions({
            params: {
              origin: `${originCoords[1]},${originCoords[0]}`,
              destination: `${destinationCoords[1]},${destinationCoords[0]}`,
              key: process.env.GOOGLE_MAPS_API_KEY
            }
          });

          const route = routeResponse.data.routes[0];
          const distance = route.legs[0].distance.value;
          const duration = route.legs[0].duration.value;
          const fare = calculateFare(distance, duration);

          matches.push({
            driverId: driver._id,
            userId: driver.user._id,
            driverName: driver.user.name,
            vehicleModel: driver.vehicleModel,
            vehiclePlate: driver.vehiclePlateNumber,
            vehicleColor: driver.vehicleColor,
            rating: driver.rating,
            pickupDistance: Math.round(pickupDistance),
            dropoffDistance: Math.round(dropoffDistance),
            detour: Math.round(detour),
            directionSimilarity: Math.round(directionSimilarity * 100),
            distance,
            duration,
            fare,
            estimatedArrival: Math.round(duration / 60) // minutes
          });
        } catch (mapsError) {
          console.error('Google Maps API error:', mapsError);
          // Fallback to estimated values
          const estimatedDistance = detour + 2000;
          const estimatedDuration = estimatedDistance / 30; // Assume 30 m/s average speed
          const fare = calculateFare(estimatedDistance, estimatedDuration);

          matches.push({
            driverId: driver._id,
            userId: driver.user._id,
            driverName: driver.user.name,
            vehicleModel: driver.vehicleModel,
            vehiclePlate: driver.vehiclePlateNumber,
            vehicleColor: driver.vehicleColor,
            rating: driver.rating,
            pickupDistance: Math.round(pickupDistance),
            dropoffDistance: Math.round(dropoffDistance),
            detour: Math.round(detour),
            directionSimilarity: Math.round(directionSimilarity * 100),
            distance: estimatedDistance,
            duration: estimatedDuration,
            fare,
            estimatedArrival: Math.round(estimatedDuration / 60)
          });
        }
      }
    }

    // Sort by best matches (lowest detour, highest similarity)
    matches.sort((a, b) => {
      if (a.detour !== b.detour) return a.detour - b.detour;
      return b.directionSimilarity - a.directionSimilarity;
    });

    return matches.slice(0, 10); // Return top 10 matches
  } catch (error) {
    console.error('Route matching error:', error);
    return [];
  }
}

/**
 * Create a new ride
 */
async function createRide(driverId, passengerData) {
  try {
    const driver = await Driver.findById(driverId);
    if (!driver) {
      throw new Error('Driver not found');
    }

    const commissionRate = parseFloat(process.env.COMMISSION_RATE) || 15;

    const ride = new Ride({
      driver: driverId,
      route: {
        origin: driver.currentRoute.origin,
        destination: driver.currentRoute.destination,
        originCoords: driver.currentRoute.originCoords,
        destinationCoords: driver.currentRoute.destinationCoords
      },
      passengers: passengerData.map(passenger => ({
        user: passenger.userId,
        pickupLocation: passenger.pickupLocation,
        dropoffLocation: passenger.dropoffLocation,
        pickupAddress: passenger.pickupAddress,
        dropoffAddress: passenger.dropoffAddress,
        fare: passenger.fare,
        distance: passenger.distance,
        duration: passenger.duration
      })),
      status: 'active',
      totalFare: passengerData.reduce((sum, p) => sum + p.fare, 0),
      commission: passengerData.reduce((sum, p) => sum + p.fare, 0) * (commissionRate / 100),
      driverEarnings: passengerData.reduce((sum, p) => sum + p.fare, 0) * (1 - commissionRate / 100),
      startedAt: new Date()
    });

    await ride.save();

    // Update driver
    driver.currentRide = ride._id;
    driver.currentPassengerCount = passengerData.length;
    driver.isAvailable = false;
    await driver.save();

    return ride;
  } catch (error) {
    console.error('Create ride error:', error);
    throw error;
  }
}

module.exports = {
  matchRoute,
  createRide,
  calculateFare,
  calculateDistance
};
