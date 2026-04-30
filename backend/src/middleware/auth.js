const jwt = require('jsonwebtoken');
const User = require('../models/User');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'Authentication token required' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.userId);

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid authentication token' });
  }
};

const driverAuth = async (req, res, next) => {
  return auth(req, res, () => {
    if (req.user.role !== 'driver') {
      return res.status(403).json({ error: 'Driver access required' });
    }

    return next();
  });
};

const passengerAuth = async (req, res, next) => {
  return auth(req, res, () => {
    if (req.user.role !== 'passenger') {
      return res.status(403).json({ error: 'Passenger access required' });
    }

    return next();
  });
};

module.exports = { auth, driverAuth, passengerAuth };
