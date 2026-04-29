const express = require('express');
const { body, validationResult } = require('express-validator');
const Ride = require('../models/Ride');
const Driver = require('../models/Driver');
const { auth, driverAuth, passengerAuth } = require('../middleware/auth');
const { matchRoute, createRide } = require('../services/routeMatchingService');
const { getIO } = require('../services/socketService');

const router = express.Router();

// Search for rides (passenger)
router.get('/search', passengerAuth, async (req, res) => {
  try {
    const { origin, destination, originLat, originLng, destLat, destLng } = req.query;

    const matches = await matchRoute({
      originCoords: [parseFloat(originLng), parseFloat(originLat)],
      destinationCoords: [parseFloat(destLng), parseFloat(destLat)],
      maxDetour: 2000
    });

    res.json({ matches });
  } catch (error) {
    console.error('Search rides error:', error);
    res.status(500).json({ error: 'Failed to search for rides' });
  }
});

// Request a ride (passenger)
router.post('/request', passengerAuth, [
  body('pickupLocation').notEmpty(),
  body('dropoffLocation').notEmpty(),
  body('pickupAddress').notEmpty(),
  body('dropoffAddress').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { pickupLocation, dropoffLocation, pickupAddress, dropoffAddress, driverId } = req.body;

    const driver = await Driver.findById(driverId).populate('user');
    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' });
    }

    // Calculate fare
    const { calculateFare, calculateDistance } = require('../services/routeMatchingService');
    const distance = calculateDistance(
      pickupLocation[1], pickupLocation[0],
      dropoffLocation[1], dropoffLocation[0]
    );
    const duration = distance / 30; // Assume 30 m/s
    const fare = calculateFare(distance, duration);

    // Notify driver via Socket.IO
    const io = getIO();
    io.to(`user_${driver.user._id}`).emit('ride_request', {
      passengerId: req.user._id,
      passengerName: req.user.name,
      pickupAddress,
      dropoffAddress,
      fare,
      estimatedArrival: Math.round(duration / 60)
    });

    res.json({
      message: 'Ride request sent to driver',
      fare,
      estimatedArrival: Math.round(duration / 60)
    });
  } catch (error) {
    console.error('Request ride error:', error);
    res.status(500).json({ error: 'Failed to request ride' });
  }
});

// Accept ride (driver)
router.post('/accept', driverAuth, [
  body('rideId').notEmpty(),
  body('passengerId').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { rideId, passengerId, pickupLocation, dropoffLocation, pickupAddress, dropoffAddress, fare, distance, duration } = req.body;

    const driver = await Driver.findOne({ user: req.user._id });
    if (!driver) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    // Check if driver has an active ride
    if (driver.currentRide) {
      const existingRide = await Ride.findById(driver.currentRide);
      if (existingRide && existingRide.status === 'active') {
        return res.status(400).json({ error: 'Driver already has an active ride' });
      }
    }

    // Create or update ride
    let ride;
    if (rideId && rideId !== 'new') {
      ride = await Ride.findById(rideId);
      if (!ride) {
        return res.status(404).json({ error: 'Ride not found' });
      }

      ride.passengers.push({
        user: passengerId,
        pickupLocation: { type: 'Point', coordinates: pickupLocation },
        dropoffLocation: { type: 'Point', coordinates: dropoffLocation },
        pickupAddress,
        dropoffAddress,
        fare,
        distance,
        duration,
        status: 'accepted'
      });

      ride.totalFare += fare;
      const commissionRate = parseFloat(process.env.COMMISSION_RATE) || 15;
      ride.commission = ride.totalFare * (commissionRate / 100);
      ride.driverEarnings = ride.totalFare * (1 - commissionRate / 100);
    } else {
      ride = await createRide(driver._id, [{
        userId: passengerId,
        pickupLocation: { type: 'Point', coordinates: pickupLocation },
        dropoffLocation: { type: 'Point', coordinates: dropoffLocation },
        pickupAddress,
        dropoffAddress,
        fare,
        distance,
        duration
      }]);
    }

    await ride.save();

    // Update driver
    driver.currentRide = ride._id;
    driver.currentPassengerCount = ride.passengers.length;
    driver.isAvailable = false;
    await driver.save();

    // Notify passenger via Socket.IO
    const io = getIO();
    io.to(`user_${passengerId}`).emit('ride_accepted', {
      rideId: ride._id,
      driverId: driver._id,
      driverName: driver.vehicleModel,
      vehiclePlate: driver.vehiclePlateNumber,
      vehicleColor: driver.vehicleColor,
      rating: driver.rating
    });

    res.json({
      message: 'Ride accepted successfully',
      rideId: ride._id,
      passengerCount: ride.passengers.length
    });
  } catch (error) {
    console.error('Accept ride error:', error);
    res.status(500).json({ error: 'Failed to accept ride' });
  }
});

// Get ride details
router.get('/:rideId', auth, async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.rideId)
      .populate('driver')
      .populate('passengers.user');

    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    res.json({ ride });
  } catch (error) {
    console.error('Get ride error:', error);
    res.status(500).json({ error: 'Failed to fetch ride details' });
  }
});

// Update ride status
router.patch('/:rideId/status', auth, [
  body('status').isIn(['searching', 'active', 'completed', 'cancelled'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { status } = req.body;
    const ride = await Ride.findById(req.params.rideId);

    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    ride.status = status;
    
    if (status === 'completed') {
      ride.completedAt = new Date();
      
      // Update driver stats
      const driver = await Driver.findById(ride.driver);
      driver.totalEarnings += ride.driverEarnings;
      driver.totalRides += 1;
      driver.isAvailable = true;
      driver.currentRide = null;
      driver.currentPassengerCount = 0;
      await driver.save();
    } else if (status === 'cancelled') {
      const driver = await Driver.findById(ride.driver);
      driver.isAvailable = true;
      driver.currentRide = null;
      driver.currentPassengerCount = 0;
      await driver.save();
    }

    await ride.save();

    // Notify relevant users via Socket.IO
    const io = getIO();
    ride.passengers.forEach(passenger => {
      io.to(`user_${passenger.user}`).emit('ride_status_updated', {
        rideId: ride._id,
        status
      });
    });

    res.json({ message: 'Ride status updated', ride });
  } catch (error) {
    console.error('Update ride status error:', error);
    res.status(500).json({ error: 'Failed to update ride status' });
  }
});

// Get user's ride history
router.get('/history/user', auth, async (req, res) => {
  try {
    const rides = await Ride.find({
      'passengers.user': req.user._id
    })
      .populate('driver')
      .populate('passengers.user')
      .sort({ createdAt: -1 })
      .limit(20);

    res.json({ rides });
  } catch (error) {
    console.error('Get ride history error:', error);
    res.status(500).json({ error: 'Failed to fetch ride history' });
  }
});

module.exports = router;
