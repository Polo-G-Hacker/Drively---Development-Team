const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Driver = require('../models/Driver');
const Ride = require('../models/Ride');
const { matchRoute } = require('./routeMatchingService');

let io;

const initializeSocket = (serverIO) => {
  io = serverIO;

  io.on('connection', async (socket) => {
    console.log(`🔌 User connected: ${socket.id}`);

    // Authenticate socket connection
    socket.on('authenticate', async (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);
        
        if (user) {
          socket.userId = user._id.toString();
          socket.userRole = user.role;
          socket.join(`user_${user._id}`);
          console.log(`✅ User authenticated: ${user.phoneNumber}`);
          socket.emit('authenticated', { success: true, userId: user._id });
        } else {
          socket.emit('authenticated', { success: false, error: 'User not found' });
        }
      } catch (error) {
        socket.emit('authenticated', { success: false, error: 'Invalid token' });
      }
    });

    // Driver broadcasts route
    socket.on('driver:broadcast_route', async (data) => {
      try {
        const { origin, destination, originCoords, destinationCoords } = data;
        
        const driver = await Driver.findOne({ user: socket.userId });
        if (!driver) {
          socket.emit('error', { message: 'Driver profile not found' });
          return;
        }

        // Update driver's current route
        driver.currentRoute = {
          origin,
          destination,
          waypoints: data.waypoints || []
        };
        driver.isAvailable = true;
        await driver.save();

        // Find matching passengers
        const matches = await matchRoute({
          originCoords,
          destinationCoords,
          maxDetour: data.maxDetour || 2000 // meters
        });

        // Notify driver of matches
        socket.emit('route_matched', { matches });

        // Notify matching passengers
        matches.forEach(match => {
          io.to(`user_${match.userId}`).emit('ride_available', {
            driverId: driver._id,
            driverName: driver.vehicleModel,
            vehiclePlate: driver.vehiclePlateNumber,
            origin,
            destination,
            estimatedArrival: match.estimatedArrival,
            fare: match.fare
          });
        });

        console.log(`🚗 Driver ${socket.userId} broadcasted route: ${origin} → ${destination}`);
      } catch (error) {
        console.error('Route broadcast error:', error);
        socket.emit('error', { message: 'Failed to broadcast route' });
      }
    });

    // Passenger requests ride
    socket.on('passenger:request_ride', async (data) => {
      try {
        const { pickupLocation, dropoffLocation, pickupAddress, dropoffAddress } = data;
        
        // Find matching drivers
        const matches = await matchRoute({
          originCoords: pickupLocation,
          destinationCoords: dropoffLocation,
          maxDetour: data.maxDetour || 2000
        });

        if (matches.length > 0) {
          // Notify matching drivers
          matches.forEach(match => {
            io.to(`user_${match.driverId}`).emit('ride_request', {
              passengerId: socket.userId,
              pickupAddress,
              dropoffAddress,
              fare: match.fare,
              estimatedArrival: match.estimatedArrival
            });
          });

          socket.emit('ride_searching', { foundMatches: matches.length });
        } else {
          // No matches found, suggest creating a new ride request
          socket.emit('no_matches_found', { message: 'No matching drivers found' });
        }

        console.log(`👤 Passenger ${socket.userId} requested ride`);
      } catch (error) {
        console.error('Ride request error:', error);
        socket.emit('error', { message: 'Failed to request ride' });
      }
    });

    // Driver accepts passenger
    socket.on('driver:accept_passenger', async (data) => {
      try {
        const { passengerId, rideId } = data;
        
        const driver = await Driver.findOne({ user: socket.userId });
        if (!driver) {
          socket.emit('error', { message: 'Driver profile not found' });
          return;
        }

        // Update ride
        const ride = await Ride.findById(rideId);
        if (ride) {
          ride.passengers.push({
            user: passengerId,
            status: 'accepted'
          });
          await ride.save();
        }

        // Notify passenger
        io.to(`user_${passengerId}`).emit('ride_accepted', {
          driverId: driver._id,
          driverName: driver.vehicleModel,
          vehiclePlate: driver.vehiclePlateNumber,
          vehicleColor: driver.vehicleColor
        });

        console.log(`✅ Driver ${socket.userId} accepted passenger ${passengerId}`);
      } catch (error) {
        console.error('Accept passenger error:', error);
        socket.emit('error', { message: 'Failed to accept passenger' });
      }
    });

    // Location updates
    socket.on('update_location', async (data) => {
      try {
        const { latitude, longitude } = data;
        
        await User.findByIdAndUpdate(socket.userId, {
          currentLocation: {
            type: 'Point',
            coordinates: [longitude, latitude]
          }
        });

        // Broadcast to passengers in current ride
        const driver = await Driver.findOne({ user: socket.userId });
        if (driver && driver.currentRide) {
          const ride = await Ride.findById(driver.currentRide);
          if (ride) {
            ride.passengers.forEach(passenger => {
              io.to(`user_${passenger.user}`).emit('driver_location_update', {
                latitude,
                longitude
              });
            });
          }
        }
      } catch (error) {
        console.error('Location update error:', error);
      }
    });

    // Disconnect
    socket.on('disconnect', async () => {
      try {
        if (socket.userId) {
          await User.findByIdAndUpdate(socket.userId, { isOnline: false });
          console.log(`🔌 User disconnected: ${socket.userId}`);
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
