const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  vehicleType: {
    type: String,
    enum: ['car', 'bike', 'minibus'],
    required: true
  },
  vehicleModel: {
    type: String,
    required: true
  },
  vehiclePlateNumber: {
    type: String,
    required: true,
    unique: true
  },
  vehicleColor: {
    type: String,
    required: true
  },
  licenseNumber: {
    type: String,
    required: true
  },
  isAvailable: {
    type: Boolean,
    default: true
  },
  currentRoute: {
    origin: {
      type: String,
      required: false
    },
    destination: {
      type: String,
      required: false
    },
    waypoints: [{
      type: String
    }]
  },
  currentRide: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ride'
  },
  passengers: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  maxPassengers: {
    type: Number,
    default: 3
  },
  currentPassengerCount: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  totalRides: {
    type: Number,
    default: 0
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  isPremium: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

driverSchema.index({ currentRoute: '2dsphere' });

module.exports = mongoose.model('Driver', driverSchema);
