const express = require('express');
const { body, validationResult } = require('express-validator');
const Driver = require('../models/Driver');
const User = require('../models/User');
const { auth, driverAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/', auth, async (req, res) => {
  try {
    const drivers = await Driver.listAll({ includeUser: true });
    return res.json({ drivers });
  } catch (error) {
    console.error('List drivers error:', error);
    return res.status(500).json({ error: 'Failed to fetch drivers' });
  }
});

router.post(
  '/profile',
  auth,
  [
    body('vehicleModel').notEmpty(),
    body('vehiclePlateNumber').notEmpty(),
    body('vehicleColor').notEmpty(),
    body('vehicleType').optional().isIn(['car', 'bike', 'minibus']),
    body('licenseNumber').optional().notEmpty(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const existingDriver = await Driver.findByUserId(req.user.id, { includeUser: true });
      if (existingDriver) {
        return res.status(400).json({ error: 'Driver profile already exists' });
      }

      const driver = await Driver.create({
        userId: req.user.id,
        vehicleType: req.body.vehicleType || 'car',
        vehicleModel: req.body.vehicleModel,
        vehiclePlateNumber: req.body.vehiclePlateNumber,
        vehicleColor: req.body.vehicleColor,
        licenseNumber: req.body.licenseNumber || req.body.vehiclePlateNumber,
      });

      return res.status(201).json({
        message: 'Driver profile created successfully',
        driver,
      });
    } catch (error) {
      console.error('Create driver profile error:', error);
      return res.status(500).json({ error: 'Failed to create driver profile' });
    }
  }
);

router.get('/profile', driverAuth, async (req, res) => {
  try {
    const driver = await Driver.findByUserId(req.user.id, { includeUser: true });
    if (!driver) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    return res.json({ driver });
  } catch (error) {
    console.error('Get driver profile error:', error);
    return res.status(500).json({ error: 'Failed to fetch driver profile' });
  }
});

router.patch(
  '/profile',
  driverAuth,
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
    body('vehicleModel').optional().trim().notEmpty().withMessage('Vehicle model cannot be empty'),
    body('vehiclePlateNumber').optional().trim().notEmpty().withMessage('Plate number cannot be empty'),
    body('vehicleColor').optional().trim().notEmpty().withMessage('Vehicle color cannot be empty'),
    body('vehicleType').optional().isIn(['car', 'bike', 'minibus']).withMessage('Invalid vehicle type'),
    body('licenseNumber').optional().trim().notEmpty().withMessage('License number cannot be empty'),
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

      const driver = await Driver.findByUserId(req.user.id);
      let updatedDriver;

      if (!driver) {
        if (!req.body.vehicleModel || !req.body.vehiclePlateNumber || !req.body.vehicleColor) {
          return res.json({
            message: 'Account details updated successfully',
            user: updatedUser,
            driver: null,
          });
        }

        updatedDriver = await Driver.create({
          userId: req.user.id,
          vehicleType: req.body.vehicleType || 'car',
          vehicleModel: req.body.vehicleModel,
          vehiclePlateNumber: req.body.vehiclePlateNumber,
          vehicleColor: req.body.vehicleColor,
          licenseNumber: req.body.licenseNumber || req.body.vehiclePlateNumber,
        });
      } else {
        updatedDriver = await Driver.updateById(driver.id, {
          vehicleType: req.body.vehicleType,
          vehicleModel: req.body.vehicleModel,
          vehiclePlateNumber: req.body.vehiclePlateNumber,
          vehicleColor: req.body.vehicleColor,
          licenseNumber: req.body.licenseNumber,
          includeUser: true,
        });
      }

      return res.json({
        message: 'Driver profile updated successfully',
        user: updatedUser,
        driver: updatedDriver,
      });
    } catch (error) {
      console.error('Update driver profile error:', error);

      if (error.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Phone number or plate number is already in use' });
      }

      return res.status(500).json({ error: 'Failed to update driver profile' });
    }
  }
);

router.patch('/availability', driverAuth, async (req, res) => {
  try {
    const driver = await Driver.findByUserId(req.user.id);
    if (!driver) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    const updatedDriver = await Driver.updateById(driver.id, {
      isAvailable: req.body.isAvailable,
      currentRoute: req.body.currentRoute,
    });

    return res.json({ message: 'Driver availability updated', driver: updatedDriver });
  } catch (error) {
    console.error('Update availability error:', error);
    return res.status(500).json({ error: 'Failed to update availability' });
  }
});

router.get('/earnings', driverAuth, async (req, res) => {
  try {
    const driver = await Driver.findByUserId(req.user.id);
    if (!driver) {
      return res.status(404).json({ error: 'Driver profile not found' });
    }

    return res.json({
      totalEarnings: driver.totalEarnings,
      totalRides: driver.totalRides,
      rating: driver.rating,
    });
  } catch (error) {
    console.error('Get earnings error:', error);
    return res.status(500).json({ error: 'Failed to fetch earnings' });
  }
});

router.get('/nearby', auth, async (req, res) => {
  try {
    const latitude = Number(req.query.latitude);
    const longitude = Number(req.query.longitude);
    const radius = Number(req.query.radius || 5000);

    if (Number.isNaN(latitude) || Number.isNaN(longitude)) {
      return res.status(400).json({ error: 'Latitude and longitude are required' });
    }

    const drivers = await Driver.listNearby({ latitude, longitude, radius });
    return res.json({ drivers });
  } catch (error) {
    console.error('Get nearby drivers error:', error);
    return res.status(500).json({ error: 'Failed to fetch nearby drivers' });
  }
});

module.exports = router;
