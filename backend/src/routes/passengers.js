const express = require('express');
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
