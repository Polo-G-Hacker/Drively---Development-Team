const express = require('express');
const { auth, passengerAuth } = require('../middleware/auth');
const User = require('../models/User');
const Community = require('../models/Community');

const router = express.Router();

// Get passenger profile
router.get('/profile', passengerAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('communities');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get passenger profile error:', error);
    res.status(500).json({ error: 'Failed to fetch passenger profile' });
  }
});

// Update passenger location
router.patch('/location', passengerAuth, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    user.currentLocation = {
      type: 'Point',
      coordinates: [parseFloat(longitude), parseFloat(latitude)]
    };

    await user.save();

    res.json({ message: 'Location updated successfully' });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ error: 'Failed to update location' });
  }
});

// Get user's communities
router.get('/communities', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('communities');
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ communities: user.communities });
  } catch (error) {
    console.error('Get communities error:', error);
    res.status(500).json({ error: 'Failed to fetch communities' });
  }
});

// Join a community
router.post('/communities/join', auth, async (req, res) => {
  try {
    const { communityId } = req.body;

    const user = await User.findById(req.user._id);
    const community = await Community.findById(communityId);

    if (!user || !community) {
      return res.status(404).json({ error: 'User or community not found' });
    }

    if (!user.communities.includes(communityId)) {
      user.communities.push(communityId);
      community.members.push(user._id);
      community.memberCount = community.members.length;
      
      await user.save();
      await community.save();
    }

    res.json({ message: 'Successfully joined community', community });
  } catch (error) {
    console.error('Join community error:', error);
    res.status(500).json({ error: 'Failed to join community' });
  }
});

// Leave a community
router.post('/communities/leave', auth, async (req, res) => {
  try {
    const { communityId } = req.body;

    const user = await User.findById(req.user._id);
    const community = await Community.findById(communityId);

    if (!user || !community) {
      return res.status(404).json({ error: 'User or community not found' });
    }

    user.communities = user.communities.filter(id => id.toString() !== communityId);
    community.members = community.members.filter(id => id.toString() !== user._id.toString());
    community.memberCount = community.members.length;
    
    await user.save();
    await community.save();

    res.json({ message: 'Successfully left community' });
  } catch (error) {
    console.error('Leave community error:', error);
    res.status(500).json({ error: 'Failed to leave community' });
  }
});

module.exports = router;
