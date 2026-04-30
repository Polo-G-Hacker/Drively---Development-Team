const express = require('express');
const { body, validationResult } = require('express-validator');

const { withTransaction } = require('../config/database');
const Driver = require('../models/Driver');
const Ride = require('../models/Ride');
const { auth, driverAuth, passengerAuth } = require('../middleware/auth');
const { calculateDistance, calculateFare, createRide, matchRoute } = require('../services/routeMatchingService');
const { getIO } = require('../services/socketService');

const router = express.Router();

function parseCoordinatePair(value) {
  if (Array.isArray(value) && value.length >= 2) {
    return [Number(value[0]), Number(value[1])];
  }

  if (value?.coordinates && Array.isArray(value.coordinates) && value.coordinates.length >= 2) {
    return [Number(value.coordinates[0]), Number(value.coordinates[1])];
  }

  return null;
}

router.get('/search', passengerAuth, async (req, res) => {
  try {
    const originCoords =
      req.query.originLng !== undefined && req.query.originLat !== undefined
        ? [Number(req.query.originLng), Number(req.query.originLat)]
        : null;
    const destinationCoords =
      req.query.destLng !== undefined && req.query.destLat !== undefined
        ? [Number(req.query.destLng), Number(req.query.destLat)]
        : null;

    const matches = await matchRoute({
      originCoords,
      destinationCoords,
      maxDetour: 2000,
    });

    return res.json({ matches });
  } catch (error) {
    console.error('Search rides error:', error);
    return res.status(500).json({ error: 'Failed to search for rides' });
  }
});

router.post(
  '/request',
  passengerAuth,
  [
    body('pickupLocation').notEmpty(),
    body('dropoffLocation').notEmpty(),
    body('pickupAddress').optional().isString(),
    body('dropoffAddress').optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const pickupLocation = parseCoordinatePair(req.body.pickupLocation);
      const dropoffLocation = parseCoordinatePair(req.body.dropoffLocation);
      const pickupAddress = req.body.pickupAddress || 'Pickup';
      const dropoffAddress = req.body.dropoffAddress || 'Dropoff';
      const driverId = req.body.driverId;

      if (!pickupLocation || !dropoffLocation || !driverId) {
        return res.status(400).json({ error: 'Pickup, dropoff, and driverId are required' });
      }

      const driver = await Driver.findById(driverId, { includeUser: true });
      if (!driver) {
        return res.status(404).json({ error: 'Driver not found' });
      }

      const distance = calculateDistance(
        pickupLocation[1],
        pickupLocation[0],
        dropoffLocation[1],
        dropoffLocation[0]
      );
      const duration = distance / 30;
      const fare = calculateFare(distance, duration);

      getIO()
        .to(`user_${driver.user?._id || driver.user?.id || driver.user}`)
        .emit('ride_request', {
          passengerId: req.user.id,
          passengerName: req.user.name,
          pickupAddress,
          dropoffAddress,
          fare,
          estimatedArrival: Math.round(duration / 60),
        });

      return res.json({
        message: 'Ride request sent to driver',
        fare,
        estimatedArrival: Math.round(duration / 60),
      });
    } catch (error) {
      console.error('Request ride error:', error);
      return res.status(500).json({ error: 'Failed to request ride' });
    }
  }
);

router.post(
  '/accept',
  driverAuth,
  [body('rideId').notEmpty(), body('passengerId').notEmpty()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await withTransaction(async (connection) => {
        const driver = await Driver.findByUserId(req.user.id, {}, connection);
        if (!driver) {
          return { status: 404, body: { error: 'Driver profile not found' } };
        }

        if (driver.currentRide) {
          const activeRide = await Ride.findById(driver.currentRide, {}, connection);
          if (activeRide && activeRide.status === 'active') {
            return { status: 400, body: { error: 'Driver already has an active ride' } };
          }
        }

        const pickupLocation = parseCoordinatePair(req.body.pickupLocation);
        const dropoffLocation = parseCoordinatePair(req.body.dropoffLocation);
        const fare = Number(req.body.fare || 0);
        const distance = Number(req.body.distance || 0);
        const duration = Number(req.body.duration || 0);
        const commissionRate = Number(process.env.COMMISSION_RATE || 15);

        let ride;
        let passengerCount;

        if (req.body.rideId && req.body.rideId !== 'new') {
          const existingRide = await Ride.findById(req.body.rideId, { includePassengers: true }, connection);
          if (!existingRide) {
            return { status: 404, body: { error: 'Ride not found' } };
          }

          await Ride.addPassenger(
            existingRide.id,
            {
              userId: req.body.passengerId,
              pickupLocation: { coordinates: pickupLocation || [0, 0] },
              dropoffLocation: { coordinates: dropoffLocation || [0, 0] },
              pickupAddress: req.body.pickupAddress || 'Pickup',
              dropoffAddress: req.body.dropoffAddress || 'Dropoff',
              fare,
              distance,
              duration,
              status: 'accepted',
            },
            connection
          );

          const passengers = await Ride.getPassengersForRide(existingRide.id, { includeUsers: true }, connection);
          passengerCount = passengers.length;
          const totalFare = existingRide.totalFare + fare;

          ride = await Ride.updateById(
            existingRide.id,
            {
              status: 'active',
              totalFare,
              commission: totalFare * (commissionRate / 100),
              driverEarnings: totalFare * (1 - commissionRate / 100),
              startedAt: existingRide.startedAt || new Date(),
            },
            connection
          );
        } else {
          ride = await createRide(
            driver.id,
            [
              {
                userId: req.body.passengerId,
                pickupLocation: { coordinates: pickupLocation || [0, 0] },
                dropoffLocation: { coordinates: dropoffLocation || [0, 0] },
                pickupAddress: req.body.pickupAddress || 'Pickup',
                dropoffAddress: req.body.dropoffAddress || 'Dropoff',
                fare,
                distance,
                duration,
                status: 'accepted',
              },
            ],
            connection
          );
          passengerCount = ride.passengers.length;
        }

        const updatedDriver = await Driver.updateById(
          driver.id,
          {
            currentRide: ride.id,
            currentPassengerCount: passengerCount,
            isAvailable: false,
          },
          connection
        );

        return {
          status: 200,
          body: {
            message: 'Ride accepted successfully',
            rideId: ride.id,
            passengerCount,
          },
          meta: { driver: updatedDriver, ride },
        };
      });

      if (result.status !== 200) {
        return res.status(result.status).json(result.body);
      }

      const { driver, ride } = result.meta;
      getIO()
        .to(`user_${req.body.passengerId}`)
        .emit('ride_accepted', {
          rideId: ride.id,
          driverId: driver.id,
          driverName: driver.user?.name || driver.vehicleModel,
          vehiclePlate: driver.vehiclePlateNumber,
          vehicleColor: driver.vehicleColor,
          rating: driver.rating,
        });

      return res.json(result.body);
    } catch (error) {
      console.error('Accept ride error:', error);
      return res.status(500).json({ error: 'Failed to accept ride' });
    }
  }
);

router.get('/history/user', auth, async (req, res) => {
  try {
    const rides = await Ride.findHistoryForUser(req.user.id);
    return res.json({ rides });
  } catch (error) {
    console.error('Get ride history error:', error);
    return res.status(500).json({ error: 'Failed to fetch ride history' });
  }
});

router.get('/:rideId', auth, async (req, res) => {
  try {
    const ride = await Ride.findById(req.params.rideId, {
      includeDriver: true,
      includePassengers: true,
      includePassengerUsers: true,
    });

    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    return res.json({ ride });
  } catch (error) {
    console.error('Get ride error:', error);
    return res.status(500).json({ error: 'Failed to fetch ride details' });
  }
});

router.patch('/:rideId/status', auth, [body('status').isIn(['searching', 'active', 'completed', 'cancelled'])], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await withTransaction(async (connection) => {
      const ride = await Ride.findById(req.params.rideId, { includePassengers: true, includePassengerUsers: true }, connection);
      if (!ride) {
        return { status: 404, body: { error: 'Ride not found' } };
      }

      const updates = { status: req.body.status };
      if (req.body.status === 'completed') {
        updates.completedAt = new Date();
      }

      const updatedRide = await Ride.updateById(ride.id, updates, connection);
      const driver = await Driver.findById(ride.driver._id || ride.driver.id || ride.driver, {}, connection);

      if (driver && req.body.status === 'completed') {
        await Driver.updateById(
          driver.id,
          {
            totalEarnings: driver.totalEarnings + updatedRide.driverEarnings,
            totalRides: driver.totalRides + 1,
            currentRide: null,
            currentPassengerCount: 0,
            isAvailable: true,
          },
          connection
        );
      } else if (driver && req.body.status === 'cancelled') {
        await Driver.updateById(
          driver.id,
          {
            currentRide: null,
            currentPassengerCount: 0,
            isAvailable: true,
          },
          connection
        );
      }

      return { status: 200, body: { message: 'Ride status updated', ride: updatedRide } };
    });

    if (result.status !== 200) {
      return res.status(result.status).json(result.body);
    }

    result.body.ride.passengers.forEach((passenger) => {
      const passengerId = passenger.user?._id || passenger.user?.id || passenger.user;
      getIO().to(`user_${passengerId}`).emit('ride_status_updated', {
        rideId: result.body.ride.id,
        status: req.body.status,
      });
    });

    return res.json(result.body);
  } catch (error) {
    console.error('Update ride status error:', error);
    return res.status(500).json({ error: 'Failed to update ride status' });
  }
});

module.exports = router;
