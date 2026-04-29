const mongoose = require('mongoose');

const rideSchema = new mongoose.Schema({
  driver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    required: true
  },
  passengers: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    pickupLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        required: true
      }
    },
    dropoffLocation: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        required: true
      }
    },
    pickupAddress: {
      type: String,
      required: true
    },
    dropoffAddress: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'picked_up', 'dropped_off', 'cancelled'],
      default: 'pending'
    },
    fare: {
      type: Number,
      required: true
    },
    distance: {
      type: Number,
      required: true
    },
    duration: {
      type: Number,
      required: true
    },
    joinedAt: {
      type: Date,
      default: Date.now
    }
  }],
  route: {
    origin: {
      type: String,
      required: true
    },
    destination: {
      type: String,
      required: true
    },
    originCoords: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        required: true
      }
    },
    destinationCoords: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        required: true
      }
    }
  },
  status: {
    type: String,
    enum: ['searching', 'active', 'completed', 'cancelled'],
    default: 'searching'
  },
  totalFare: {
    type: Number,
    required: true
  },
  commission: {
    type: Number,
    required: true
  },
  driverEarnings: {
    type: Number,
    required: true
  },
  startedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  community: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Community'
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

rideSchema.index({ 'route.originCoords': '2dsphere' });
rideSchema.index({ 'route.destinationCoords': '2dsphere' });

module.exports = mongoose.model('Ride', rideSchema);
