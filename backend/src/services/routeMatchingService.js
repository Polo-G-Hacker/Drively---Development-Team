const { Client } = require('@googlemaps/google-maps-services-js');

const Driver = require('../models/Driver');
const Ride = require('../models/Ride');

const googleMapsClient = new Client({});

function calculateDistance(lat1, lon1, lat2, lon2) {
  const radius = 6371e3;
  const lat1Radians = (lat1 * Math.PI) / 180;
  const lat2Radians = (lat2 * Math.PI) / 180;
  const deltaLat = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLon = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Radians) * Math.cos(lat2Radians) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);

  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateDirectionSimilarity(origin1, dest1, origin2, dest2) {
  const angle1 = Math.atan2(dest1[1] - origin1[1], dest1[0] - origin1[0]);
  const angle2 = Math.atan2(dest2[1] - origin2[1], dest2[0] - origin2[0]);

  const angleDiff = Math.abs(angle1 - angle2);
  return 1 - angleDiff / Math.PI;
}

function calculateFare(distance, duration) {
  const pricePerKm = 200;
  const pricePerMinute = 10;

  const distanceCost = (distance / 1000) * pricePerKm;
  const timeCost = (duration / 60) * pricePerMinute;

  return Math.round(distanceCost + timeCost);
}

function buildFallbackMatch(driver) {
  const estimatedDistance = 5000;
  const estimatedDuration = 900;
  const fare = calculateFare(estimatedDistance, estimatedDuration);

  return {
    driverId: driver.id,
    userId: driver.user?._id || driver.user?.id || driver.user,
    driverName: driver.user?.name || driver.vehicleModel,
    vehicleModel: driver.vehicleModel,
    vehiclePlate: driver.vehiclePlateNumber,
    vehicleColor: driver.vehicleColor,
    rating: driver.rating,
    pickupDistance: 0,
    dropoffDistance: 0,
    detour: 0,
    directionSimilarity: 100,
    distance: estimatedDistance,
    duration: estimatedDuration,
    fare,
    estimatedArrival: Math.round(estimatedDuration / 60),
  };
}

async function matchRoute({ originCoords, destinationCoords, maxDetour = 2000 }) {
  try {
    const drivers = await Driver.listAvailableWithRoutes();

    if (!Array.isArray(originCoords) || !Array.isArray(destinationCoords)) {
      return drivers.slice(0, 10).map(buildFallbackMatch);
    }

    const matches = [];

    for (const driver of drivers) {
      const driverOrigin = driver.currentRoute.originCoords?.coordinates;
      const driverDestination = driver.currentRoute.destinationCoords?.coordinates;

      if (!driverOrigin || !driverDestination) {
        continue;
      }

      if (driver.currentPassengerCount >= driver.maxPassengers) {
        continue;
      }

      const pickupDistance = calculateDistance(
        originCoords[1],
        originCoords[0],
        driverOrigin[1],
        driverOrigin[0]
      );

      const dropoffDistance = calculateDistance(
        destinationCoords[1],
        destinationCoords[0],
        driverDestination[1],
        driverDestination[0]
      );

      const directionSimilarity = calculateDirectionSimilarity(
        originCoords,
        destinationCoords,
        driverOrigin,
        driverDestination
      );

      const detour = pickupDistance + dropoffDistance;
      if (detour > maxDetour || directionSimilarity <= 0.5) {
        continue;
      }

      try {
        const routeResponse = await googleMapsClient.directions({
          params: {
            origin: `${originCoords[1]},${originCoords[0]}`,
            destination: `${destinationCoords[1]},${destinationCoords[0]}`,
            key: process.env.GOOGLE_MAPS_API_KEY,
          },
        });

        const route = routeResponse.data.routes[0];
        const distance = route?.legs?.[0]?.distance?.value || detour;
        const duration = route?.legs?.[0]?.duration?.value || detour / 30;
        const fare = calculateFare(distance, duration);

        matches.push({
          driverId: driver.id,
          userId: driver.user?._id || driver.user?.id || driver.user,
          driverName: driver.user?.name || driver.vehicleModel,
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
          estimatedArrival: Math.round(duration / 60),
        });
      } catch (mapsError) {
        const estimatedDistance = detour + 2000;
        const estimatedDuration = estimatedDistance / 30;
        const fare = calculateFare(estimatedDistance, estimatedDuration);

        matches.push({
          driverId: driver.id,
          userId: driver.user?._id || driver.user?.id || driver.user,
          driverName: driver.user?.name || driver.vehicleModel,
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
          estimatedArrival: Math.round(estimatedDuration / 60),
        });
      }
    }

    matches.sort((left, right) => {
      if (left.detour !== right.detour) {
        return left.detour - right.detour;
      }

      return right.directionSimilarity - left.directionSimilarity;
    });

    return matches.slice(0, 10);
  } catch (error) {
    console.error('Route matching error:', error);
    return [];
  }
}

async function createRide(driverId, passengerData, connection = null) {
  const driver = await Driver.findById(driverId, {}, connection);
  if (!driver) {
    throw new Error('Driver not found');
  }

  const commissionRate = Number(process.env.COMMISSION_RATE || 15);
  const totalFare = passengerData.reduce((sum, passenger) => sum + passenger.fare, 0);

  const ride = await Ride.create(
    {
      driverId,
      route: {
        origin: driver.currentRoute.origin || 'Current Route',
        destination: driver.currentRoute.destination || 'Destination',
        originCoords: driver.currentRoute.originCoords,
        destinationCoords: driver.currentRoute.destinationCoords,
      },
      passengers: passengerData,
      status: 'active',
      totalFare,
      commission: totalFare * (commissionRate / 100),
      driverEarnings: totalFare * (1 - commissionRate / 100),
      startedAt: new Date(),
    },
    connection
  );

  await Driver.updateById(
    driverId,
    {
      currentRide: ride.id,
      currentPassengerCount: passengerData.length,
      isAvailable: false,
    },
    connection
  );

  return Ride.findById(ride.id, {
    includeDriver: true,
    includePassengers: true,
    includePassengerUsers: true,
  }, connection);
}

module.exports = {
  calculateDistance,
  calculateFare,
  createRide,
  matchRoute,
};
