const jwt = require('jsonwebtoken');

const Driver = require('../models/Driver');
const Ride = require('../models/Ride');
const User = require('../models/User');
const { matchRoute } = require('./routeMatchingService');

let io;

function normalizeTokenPayload(payload) {
  if (typeof payload === 'string') {
    return payload;
  }

  return payload?.token || null;
}

function normalizeCoordinatePair(value) {
  if (Array.isArray(value) && value.length >= 2) {
    return [Number(value[0]), Number(value[1])];
  }

  if (value && typeof value === 'object' && 'longitude' in value && 'latitude' in value) {
    return [Number(value.longitude), Number(value.latitude)];
  }

  if (value?.coordinates && Array.isArray(value.coordinates)) {
    return [Number(value.coordinates[0]), Number(value.coordinates[1])];
  }

  return null;
}

const initializeSocket = (serverIO) => {
  io = serverIO;

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    socket.on('authenticate', async (payload) => {
      try {
        const token = normalizeTokenPayload(payload);
        if (!token) {
          socket.emit('authenticated', { success: false, error: 'Token missing' });
          return;
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
          socket.emit('authenticated', { success: false, error: 'User not found' });
          return;
        }

        socket.userId = user.id;
        socket.userRole = user.role;
        socket.join(`user_${user.id}`);

        socket.emit('authenticated', { success: true, userId: user.id });
      } catch (error) {
        socket.emit('authenticated', { success: false, error: 'Invalid token' });
      }
    });

    socket.on('driver:broadcast_route', async (data) => {
      try {
        const driver = await Driver.findByUserId(socket.userId);
        if (!driver) {
          socket.emit('error', { message: 'Driver profile not found' });
          return;
        }

        const originCoords = normalizeCoordinatePair(data.originCoords || data.origin);
        const destinationCoords = normalizeCoordinatePair(data.destinationCoords || data.destination);

        await Driver.updateById(driver.id, {
          currentRoute: {
            origin: data.originAddress || data.origin?.address || data.origin?.name || 'Origin',
            destination:
              data.destinationAddress || data.destination?.address || data.destination?.name || 'Destination',
            originCoords,
            destinationCoords,
            waypoints: data.waypoints || [],
          },
          isAvailable: true,
        });

        const matches = await matchRoute({
          originCoords,
          destinationCoords,
          maxDetour: data.maxDetour || 2000,
        });

        socket.emit('route_matched', { matches });

        matches.forEach((match) => {
          io.to(`user_${match.userId}`).emit('ride_available', {
            driverId: driver.id,
            driverName: driver.vehicleModel,
            vehiclePlate: driver.vehiclePlateNumber,
            origin: data.originAddress || 'Origin',
            destination: data.destinationAddress || 'Destination',
            estimatedArrival: match.estimatedArrival,
            fare: match.fare,
          });
        });
      } catch (error) {
        console.error('Route broadcast error:', error);
        socket.emit('error', { message: 'Failed to broadcast route' });
      }
    });

    socket.on('passenger:request_ride', async (data) => {
      try {
        const matches = await matchRoute({
          originCoords: normalizeCoordinatePair(data.pickupLocation),
          destinationCoords: normalizeCoordinatePair(data.dropoffLocation),
          maxDetour: data.maxDetour || 2000,
        });

        if (matches.length === 0) {
          socket.emit('no_matches_found', { message: 'No matching drivers found' });
          return;
        }

        matches.forEach((match) => {
          io.to(`user_${match.userId}`).emit('ride_request', {
            passengerId: socket.userId,
            pickupAddress: data.pickupAddress,
            dropoffAddress: data.dropoffAddress,
            fare: match.fare,
            estimatedArrival: match.estimatedArrival,
          });
        });

        socket.emit('ride_searching', { foundMatches: matches.length });
      } catch (error) {
        console.error('Ride request error:', error);
        socket.emit('error', { message: 'Failed to request ride' });
      }
    });

    socket.on('driver:accept_passenger', async (data) => {
      try {
        const driver = await Driver.findByUserId(socket.userId);
        if (!driver) {
          socket.emit('error', { message: 'Driver profile not found' });
          return;
        }

        if (data.rideId) {
          const ride = await Ride.findById(data.rideId);
          if (ride) {
            io.to(`user_${data.passengerId}`).emit('ride_accepted', {
              rideId: ride.id,
              driverId: driver.id,
              driverName: driver.vehicleModel,
              vehiclePlate: driver.vehiclePlateNumber,
              vehicleColor: driver.vehicleColor,
            });
          }
        }
      } catch (error) {
        console.error('Accept passenger error:', error);
        socket.emit('error', { message: 'Failed to accept passenger' });
      }
    });

    socket.on('update_location', async (data) => {
      try {
        const latitude = Number(data.latitude ?? data.location?.latitude);
        const longitude = Number(data.longitude ?? data.location?.longitude);
        await User.updateLocation(socket.userId, { latitude, longitude });

        const driver = await Driver.findByUserId(socket.userId);
        if (!driver?.currentRide) {
          return;
        }

        const ride = await Ride.findById(driver.currentRide, {
          includePassengers: true,
          includePassengerUsers: true,
        });

        if (!ride) {
          return;
        }

        ride.passengers.forEach((passenger) => {
          const passengerId = passenger.user?._id || passenger.user?.id || passenger.user;
          io.to(`user_${passengerId}`).emit('driver_location_update', { latitude, longitude });
        });
      } catch (error) {
        console.error('Location update error:', error);
      }
    });

    socket.on('disconnect', async () => {
      try {
        if (socket.userId) {
          await User.updateOnlineStatus(socket.userId, false);
        }
      } catch (error) {
        console.error('Disconnect error:', error);
      }
    });
  });

  return io;
};

const getIO = () => io;

module.exports = { initializeSocket, getIO };
