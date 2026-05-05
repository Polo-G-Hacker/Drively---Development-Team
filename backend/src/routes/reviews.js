const express = require('express');
const { body, validationResult } = require('express-validator');
const Review = require('../models/Review');
const Ride = require('../models/Ride');
const { auth } = require('../middleware/auth');
const { withTransaction } = require('../config/database');

const router = express.Router();

// Get reviews for the current user (as reviewee)
router.get('/me', auth, async (req, res) => {
  try {
    const reviews = await Review.findByRevieweeId(req.user.id);
    return res.json({ reviews });
  } catch (error) {
    console.error('Get reviews error:', error);
    return res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Get reviews written by the current user
router.get('/authored', auth, async (req, res) => {
  try {
    const reviews = await Review.findByReviewerId(req.user.id);
    return res.json({ reviews });
  } catch (error) {
    console.error('Get authored reviews error:', error);
    return res.status(500).json({ error: 'Failed to fetch authored reviews' });
  }
});

// Get my review for a specific user
router.get('/my-review/:revieweeId', auth, async (req, res) => {
  try {
    const review = await Review.findByReviewerAndReviewee(req.user.id, req.params.revieweeId);
    return res.json({ review });
  } catch (error) {
    console.error('Get my review error:', error);
    return res.status(500).json({ error: 'Failed to fetch review' });
  }
});

// Get reviews for a specific user
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const reviews = await Review.findByRevieweeId(req.params.userId);
    return res.json({ reviews });
  } catch (error) {
    console.error('Get user reviews error:', error);
    return res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

// Create a review
router.post(
  '/',
  auth,
  [
    body('rideId').optional({ nullable: true }),
    body('revieweeId').notEmpty(),
    body('rating').isInt({ min: 1, max: 5 }),
    body('comment').optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { rideId, revieweeId, rating, comment } = req.body;

      // If rideId is provided, verify it
      if (rideId) {
        const ride = await Ride.findById(rideId, { includePassengers: true });
        if (!ride) {
          return res.status(404).json({ error: 'Ride not found' });
        }

        const isDriver = ride.driver._id === req.user.id || ride.driver === req.user.id;
        const isPassenger = ride.passengers.some(p => (p.user._id || p.user) === req.user.id);

        if (!isDriver && !isPassenger) {
          return res.status(403).json({ error: 'You were not part of this ride' });
        }
      }

      const result = await withTransaction(async (connection) => {
        // Check if a review already exists for this pair
        const existing = await Review.findByReviewerAndReviewee(req.user.id, revieweeId, connection);
        if (existing) {
          return await Review.updateById(existing.id, { rating, comment }, connection);
        }

        const review = await Review.create({
          rideId,
          reviewerId: req.user.id,
          revieweeId,
          rating,
          comment,
          reviewerRole: req.user.role,
        }, connection);

        return review;
      });

      return res.json({ message: 'Review submitted successfully', review: result });
    } catch (error) {
      console.error('Create review error:', error);
      return res.status(500).json({ error: 'Failed to submit review' });
    }
  }
);

// Update a review
router.put(
  '/:id',
  auth,
  [
    body('rating').optional().isInt({ min: 1, max: 5 }),
    body('comment').optional().isString(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { rating, comment } = req.body;
      const result = await Review.updateById(req.params.id, { rating, comment });

      if (!result) {
        return res.status(404).json({ error: 'Review not found' });
      }

      return res.json({ message: 'Review updated successfully', review: result });
    } catch (error) {
      console.error('Update review error:', error);
      return res.status(500).json({ error: 'Failed to update review' });
    }
  }
);

module.exports = router;
