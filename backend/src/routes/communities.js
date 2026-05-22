const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, driverAuth, passengerAuth } = require('../middleware/auth');
const Community = require('../models/Community');
const { matchCommunityRoute } = require('../services/routeMatchingService');
const { getIO } = require('../services/socketService');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const communities = await Community.listAll();
    return res.json({ communities });
  } catch (error) {
    console.error('List communities error:', error);
    return res.status(500).json({ error: 'Failed to fetch communities' });
  }
});

router.post(
  '/',
  driverAuth,
  [
    body('origin').trim().notEmpty().withMessage('Origin is required'),
    body('destination').trim().notEmpty().withMessage('Destination is required'),
    body('description')
      .optional({ nullable: true })
      .customSanitizer((value) => (value === '' ? null : value))
      .isString()
      .withMessage('Description must be a string'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const community = await Community.create(
        {
          origin: req.body.origin.trim(),
          destination: req.body.destination.trim(),
          description: req.body.description,
        },
        req.user.id
      );

      return res.status(201).json({
        message: 'Community created successfully',
        community,
      });
    } catch (error) {
      console.error('Create community error:', error);

      if (error.code === 'SIMILAR_COMMUNITY_EXISTS') {
        return res.status(409).json({
          error: error.message,
          community: error.community || null,
        });
      }

      return res.status(500).json({ error: 'Failed to create community' });
    }
  }
);

router.post('/:communityId/request-ride', passengerAuth, async (req, res) => {
  try {
    const community = await Community.findById(req.params.communityId);
    if (!community) {
      return res.status(404).json({ error: 'Community not found' });
    }

    const matches = await matchCommunityRoute({
      origin: community.origin,
      destination: community.destination,
      limit: 1,
    });

    if (!matches.length) {
      return res.status(404).json({
        error: 'No drivers are available on this community route right now.',
      });
    }

    const bestMatch = matches[0];

    getIO()
      .to(`user_${bestMatch.userId}`)
      .emit('ride_request', {
        passengerId: req.user.id,
        passengerName: req.user.name,
        pickupAddress: community.origin,
        dropoffAddress: community.destination,
        fare: bestMatch.fare,
        estimatedArrival: bestMatch.estimatedArrival,
      });

    return res.json({
      message: 'Ride request sent to driver',
      community,
      driver: {
        id: bestMatch.driverId,
        name: bestMatch.driverName,
        vehicleModel: bestMatch.vehicleModel,
        vehiclePlate: bestMatch.vehiclePlate,
        vehicleColor: bestMatch.vehicleColor,
        rating: bestMatch.rating,
      },
      fare: bestMatch.fare,
      estimatedArrival: bestMatch.estimatedArrival,
      distance: bestMatch.distance,
    });
  } catch (error) {
    console.error('Request community ride error:', error);
    return res.status(500).json({ error: 'Failed to request ride from this community' });
  }
});

module.exports = router;
