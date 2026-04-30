const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const { auth } = require('../middleware/auth');

const router = express.Router();

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
        user: {
          id: user.id,
          _id: user._id,
          phoneNumber: user.phoneNumber,
          name: user.name,
          role: user.role,
        },
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
        user: {
          id: onlineUser.id,
          _id: onlineUser._id,
          phoneNumber: onlineUser.phoneNumber,
          name: onlineUser.name,
          role: onlineUser.role,
          rating: onlineUser.rating,
          wallet: onlineUser.wallet,
        },
      });
    } catch (error) {
      console.error('Login error:', error);
      return res.status(500).json({ error: 'Login failed' });
    }
  }
);

router.get('/me', auth, async (req, res) => {
  return res.json({
    user: {
      id: req.user.id,
      _id: req.user._id,
      phoneNumber: req.user.phoneNumber,
      name: req.user.name,
      role: req.user.role,
      rating: req.user.rating,
      isVerified: req.user.isVerified,
      wallet: req.user.wallet,
    },
  });
});

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
