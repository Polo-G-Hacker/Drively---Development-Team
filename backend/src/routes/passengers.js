const express = require('express');
const { body, validationResult } = require('express-validator');
const { auth, passengerAuth } = require('../middleware/auth');
const User = require('../models/User');
const Community = require('../models/Community');

const router = express.Router();

router.get('/profile', passengerAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const communities = await Community.listByUserId(req.user.id);
    return res.json({ user: { ...user, communities } });
  } catch (error) {
    console.error('Get passenger profile error:', error);
    return res.status(500).json({ error: 'Failed to fetch passenger profile' });
  }
});

router.patch(
  '/profile',
  passengerAuth,
  [
    body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
    body('phoneNumber').optional().trim().notEmpty().withMessage('Phone number cannot be empty'),
    body('email')
      .customSanitizer((value) => (value === '' ? null : value))
      .custom((value) => value === undefined || value === null || /\S+@\S+\.\S+/.test(value))
      .withMessage('Email must be valid'),
    body('profileImage')
      .optional({ nullable: true })
      .customSanitizer((value) => (value === '' ? null : value))
      .custom((value) => value === undefined || value === null || typeof value === 'string')
      .withMessage('Profile image must be a string'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const updatedUser = await User.updateById(req.user.id, {
        name: req.body.name,
        phoneNumber: req.body.phoneNumber,
        email: req.body.email,
        profileImage: req.body.profileImage,
      });

      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      const communities = await Community.listByUserId(req.user.id);
      return res.json({
        message: 'Profile updated successfully',
        user: { ...updatedUser, communities },
      });
    } catch (error) {
      console.error('Update passenger profile error:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Phone number is already in use' });
      }

      return res.status(500).json({ error: 'Failed to update profile' });
    }
  }
);

router.patch('/location', passengerAuth, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await User.updateLocation(req.user.id, {
      latitude: Number(latitude),
      longitude: Number(longitude),
    });

    return res.json({ message: 'Location updated successfully' });
  } catch (error) {
    console.error('Update location error:', error);
    return res.status(500).json({ error: 'Failed to update location' });
  }
});

router.get('/communities', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const communities = await Community.listByUserId(req.user.id);
    return res.json({ communities });
  } catch (error) {
    console.error('Get communities error:', error);
    return res.status(500).json({ error: 'Failed to fetch communities' });
  }
});

router.post('/communities/join', auth, async (req, res) => {
  try {
    const { communityId } = req.body;
    const community = await Community.joinCommunity(req.user.id, communityId);

    if (!community) {
      return res.status(404).json({ error: 'User or community not found' });
    }

    return res.json({ message: 'Successfully joined community', community });
  } catch (error) {
    console.error('Join community error:', error);
    return res.status(500).json({ error: 'Failed to join community' });
  }
});

router.post('/communities/leave', auth, async (req, res) => {
  try {
    await Community.leaveCommunity(req.user.id, req.body.communityId);
    return res.json({ message: 'Successfully left community' });
  } catch (error) {
    console.error('Leave community error:', error);
    return res.status(500).json({ error: 'Failed to leave community' });
  }
});

module.exports = router;
