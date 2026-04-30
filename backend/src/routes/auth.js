const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

function buildAuthUserPayload(user) {
  return {
    id: user.id,
    _id: user._id,
    phoneNumber: user.phoneNumber,
    name: user.name,
    role: user.role,
    email: user.email || null,
    profileImage: user.profileImage || null,
    rating: user.rating,
    isVerified: user.isVerified,
    wallet: user.wallet,
    settings: user.settings,
  };
}

router.post(
  '/register',
  [
    body('phoneNumber').trim().notEmpty().withMessage('Phone number is required'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('name').trim().notEmpty().withMessage('Name is required'),
    body('role').isIn(['driver', 'passenger']).withMessage('Role must be driver or passenger'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { phoneNumber, password, name, role, email } = req.body;
      const existingUser = await User.findByPhoneNumber(phoneNumber);

      if (existingUser) {
        return res.status(400).json({ error: 'User with this phone number already exists' });
      }

      const user = await User.create({ phoneNumber, password, name, role, email });
      const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, {
        expiresIn: '7d',
      });

      return res.status(201).json({
        message: 'User registered successfully',
        token,
        user: buildAuthUserPayload(user),
      });
    } catch (error) {
      console.error('Registration error:', error);
      return res.status(500).json({ error: 'Registration failed' });
    }
  }
);

router.post(
  '/login',
  [
    body('phoneNumber').trim().notEmpty().withMessage('Phone number is required'),
    body('password').notEmpty().withMessage('Password is required'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { phoneNumber, password } = req.body;
      const user = await User.findByPhoneNumber(phoneNumber, { includePassword: true });

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const isMatch = await User.comparePassword(user, password);
      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const onlineUser = await User.updateOnlineStatus(user.id, true);
      const token = jwt.sign({ userId: onlineUser.id, role: onlineUser.role }, process.env.JWT_SECRET, {
        expiresIn: '7d',
      });

      return res.json({
        message: 'Login successful',
        token,
        user: buildAuthUserPayload(onlineUser),
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Login failed' });
    }
  }
);

router.get('/me', auth, async (req, res) => {
  return res.json({
    user: buildAuthUserPayload(req.user),
  });
});

router.patch(
  '/settings',
  auth,
  [
    body('settings').isObject().withMessage('Settings are required'),
    body('settings.notifications.rideUpdates').optional().isBoolean().withMessage('Ride updates preference must be a boolean'),
    body('settings.notifications.smsUpdates').optional().isBoolean().withMessage('SMS updates preference must be a boolean'),
    body('settings.notifications.promotions').optional().isBoolean().withMessage('Promotions preference must be a boolean'),
    body('settings.privacy.shareLiveLocation').optional().isBoolean().withMessage('Location sharing preference must be a boolean'),
    body('settings.privacy.communityVisibility').optional().isBoolean().withMessage('Community visibility preference must be a boolean'),
    body('settings.security.loginAlerts').optional().isBoolean().withMessage('Login alert preference must be a boolean'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const updatedUser = await User.updateById(req.user.id, {
        settings: req.body.settings,
      });

      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({
        message: 'Settings updated successfully',
        user: buildAuthUserPayload(updatedUser),
      });
    } catch (error) {
      console.error('Update settings error:', error);
      return res.status(500).json({ error: 'Failed to update settings' });
    }
  }
);

router.patch(
  '/password',
  auth,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters'),
    body('confirmPassword')
      .notEmpty()
      .withMessage('Please confirm your new password')
      .custom((value, { req }) => value === req.body.newPassword)
      .withMessage('Password confirmation does not match'),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const updatedUser = await User.updatePassword(req.user.id, req.body.currentPassword, req.body.newPassword);

      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }

      return res.json({
        message: 'Password updated successfully',
        user: buildAuthUserPayload(updatedUser),
      });
    } catch (error) {
      console.error('Update password error:', error);

      if (error.code === 'INVALID_CURRENT_PASSWORD' || error.code === 'PASSWORD_REUSE') {
        return res.status(400).json({ error: error.message });
      }

      return res.status(500).json({ error: 'Failed to update password' });
    }
  }
);

router.post('/logout', auth, async (req, res) => {
  try {
    await User.updateOnlineStatus(req.user.id, false);
    return res.json({ message: 'Logout successful' });
  } catch (error) {
    console.error('Logout error:', error);
    return res.status(500).json({ error: 'Logout failed' });
  }
});

module.exports = router;
