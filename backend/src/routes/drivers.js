const express = require('express');
const { body, validationResult } = require('express-validator');
const Driver = require('../models/Driver');
const { auth, driverAuth } = require('../middleware/auth');

const router = express.Router();

// Create driver profile
router.post('/profile', auth, [
  body('vehicleType').isIn(['car', 'bike', 'minibus']),
  body('vehicleModel').notEmpty(),
  body('vehiclePlateNumber').notEmpty(),
  body('vehicleColor').notEmpty(),
  body('licenseNumber').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { vehicleType, vehicleModel, vehiclePlateNumber, vehicleColor, licenseNumber } = req.body;

    // Check if driver profile already exists
    const existingDriver = await Driver.findOne({ user: req.user._id });
    if (existingDriver) {
      return res.status(400).json({ error: 'Driver profile already exists' });
    }

    const driver = new Driver({
      user: req.user._id,
      vehicleType,
      vehicleModel,
      vehiclePlateNumber,
      vehicleColor,
      licenseNumber
    });

    await driver.save();

    res.status(201).json({
      message: 'Driver profile created successfully',
      driver
    });
  } catch (error) {
    console.error('Create driver profile error:', error);
    res.status(500).json({ error: 'Failed to create driver profile' });
  }
});

// Get driver profile
router.get('/profile', driverAuth, async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id }).populate('user');
    
    if (!driver) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    res.json({ driver });
  } catch (error) {
    console.error('Get driver profile error:', error);
    res.status(500).json({ error: 'Failed to fetch driver profile' });
  }
});

// Update driver availability
router.patch('/availability', driverAuth, async (req, res) => {
  try {
    const { isAvailable, currentRoute } = req.body;

    const driver = await Driver.findOne({ user: req.user._id });
    
    if (!driver) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    driver.isAvailable = isAvailable !== undefined ? isAvailable : driver.isAvailable;
    
    if (currentRoute) {
      driver.currentRoute = currentRoute;
    }

    await driver.save();

    res.json({ message: 'Driver availability updated', driver });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({ error: 'Failed to update availability' });
  }
});

// Get driver earnings
router.get('/earnings', driverAuth, async (req, res) => {
  try {
    const driver = await Driver.findOne({ user: req.user._id });
    
    if (!driver) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    res.json({
      totalEarnings: driver.totalEarnings,
      totalRides: driver.totalRides,
      rating: driver.rating
    });
  } catch (error) {
    console.error('Get earnings error:', error);
    res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

// Get nearby drivers
router.get('/nearby', auth, async (req, res) => {
  try {
    const { latitude, longitude, radius = 5000 } = req.query;

    const drivers = await Driver.find({
      isAvailable: true,
      currentLocation: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(longitude), parseFloat(latitude)]
          },
          $maxDistance: parseFloat(radius)
        }
      }
    }).populate('user');

    res.json({ drivers });
  } catch (error) {
    console.error('Get nearby drivers error:', error);
    res.status(500).json({ error: 'Failed to fetch nearby drivers' });
  }
});

module.exports = router;
