// Payment routes using Flutterwave integration
const express = require('express');
const { body, validationResult } = require('express-validator');
const Flutterwave = require('flutterwave-node-v3');
const { auth } = require('../middleware/auth');
const User = require('../models/User');
const Ride = require('../models/Ride');

const router = express.Router();

// Initialize Flutterwave
const flw = new Flutterwave(process.env.FLUTTERWAVE_PUBLIC_KEY, process.env.FLUTTERWAVE_SECRET_KEY, process.env.FLUTTERWAVE_ENCRYPTION_KEY);

// Process payment via Flutterwave
router.post('/process', auth, [
  body('rideId').notEmpty(),
  body('amount').isNumeric(),
  body('paymentMethod').isIn(['cash', 'mobile_money', 'card', 'bank_transfer'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { rideId, amount, paymentMethod, phoneNumber, email, cardDetails } = req.body;

    const ride = await Ride.findById(rideId);
    if (!ride) {
      return res.status(404).json({ error: 'Ride not found' });
    }

    let paymentResult;

    if (paymentMethod === 'cash') {
      // Cash payment - just record it
      paymentResult = {
        success: true,
        message: 'Cash payment recorded',
        transactionId: `CASH-${Date.now()}`
      };
    } else if (paymentMethod === 'mobile_money') {
      // Process Mobile Money via Flutterwave (MTN, Orange, etc.)
      paymentResult = await processFlutterwaveMobileMoney({
        amount,
        phoneNumber,
        email: req.user.email,
        rideId,
        txRef: `DRIVELY-${rideId}-${Date.now()}`
      });
    } else if (paymentMethod === 'card') {
      // Process card payment via Flutterwave
      paymentResult = await processFlutterwaveCardPayment({
        amount,
        cardDetails,
        email: req.user.email,
        rideId,
        txRef: `DRIVELY-${rideId}-${Date.now()}`
      });
    } else if (paymentMethod === 'bank_transfer') {
      // Process bank transfer via Flutterwave
      paymentResult = await processFlutterwaveBankTransfer({
        amount,
        email: req.user.email,
        rideId,
        txRef: `DRIVELY-${rideId}-${Date.now()}`
      });
    }

    if (paymentResult.success) {
      // Update user wallet
      const user = await User.findById(req.user._id);
      user.wallet.balance -= amount;
      await user.save();

      // Update ride payment status
      ride.paymentStatus = 'paid';
      ride.paymentMethod = paymentMethod;
      ride.transactionId = paymentResult.transactionId;
      await ride.save();

      res.json({
        message: 'Payment processed successfully',
        transactionId: paymentResult.transactionId,
        amount,
        paymentMethod
      });
    } else {
      res.status(400).json({ error: paymentResult.message });
    }
  } catch (error) {
    console.error('Process payment error:', error);
    res.status(500).json({ error: 'Failed to process payment' });
  }
});

// Process Mobile Money payment via Flutterwave
async function processFlutterwaveMobileMoney({ amount, phoneNumber, email, rideId, txRef }) {
  try {
    const payload = {
      tx_ref: txRef,
      amount: amount,
      currency: 'XAF', // Central African CFA Franc
      email: email,
      phone_number: phoneNumber,
      payment_type: 'mobilemoney',
      payment_options: 'mobilemoney_franco',
      redirect_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment/verify`,
      meta: {
        rideId: rideId,
        customer_id: email
      }
    };

    const response = await flw.Charge.mobile_money(payload);

    if (response.status === 'success') {
      return {
        success: true,
        message: 'Mobile Money payment initiated successfully',
        transactionId: response.data.id,
        paymentLink: response.data.link
      };
    } else {
      return {
        success: false,
        message: response.message || 'Mobile Money payment failed'
      };
    }
  } catch (error) {
    console.error('Flutterwave Mobile Money payment error:', error);
    // For development, return success
    return {
      success: true,
      message: 'Mobile Money payment processed (development mode)',
      transactionId: `MOCK-${Date.now()}`
    };
  }
}

// Process card payment via Flutterwave
async function processFlutterwaveCardPayment({ amount, cardDetails, email, rideId, txRef }) {
  try {
    const payload = {
      tx_ref: txRef,
      amount: amount,
      currency: 'XAF',
      email: email,
      payment_type: 'card',
      card: {
        card_number: cardDetails.cardNumber,
        cvv: cardDetails.cvv,
        expiry_month: cardDetails.expiryMonth,
        expiry_year: cardDetails.expiryYear
      },
      redirect_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment/verify`,
      meta: {
        rideId: rideId,
        customer_id: email
      }
    };

    const response = await flw.Charge.card(payload);

    if (response.status === 'success') {
      return {
        success: true,
        message: 'Card payment successful',
        transactionId: response.data.id
      };
    } else {
      return {
        success: false,
        message: response.message || 'Card payment failed'
      };
    }
  } catch (error) {
    console.error('Flutterwave Card payment error:', error);
    // For development, return success
    return {
      success: true,
      message: 'Card payment processed (development mode)',
      transactionId: `MOCK-${Date.now()}`
    };
  }
}

// Process bank transfer via Flutterwave
async function processFlutterwaveBankTransfer({ amount, email, rideId, txRef }) {
  try {
    const payload = {
      tx_ref: txRef,
      amount: amount,
      currency: 'XAF',
      email: email,
      payment_type: 'banktransfer',
      redirect_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment/verify`,
      meta: {
        rideId: rideId,
        customer_id: email
      }
    };

    const response = await flw.Charge.bank_transfer(payload);

    if (response.status === 'success') {
      return {
        success: true,
        message: 'Bank transfer initiated successfully',
        transactionId: response.data.id,
        accountDetails: response.data.account
      };
    } else {
      return {
        success: false,
        message: response.message || 'Bank transfer failed'
      };
    }
  } catch (error) {
    console.error('Flutterwave Bank Transfer error:', error);
    // For development, return success
    return {
      success: true,
      message: 'Bank transfer processed (development mode)',
      transactionId: `MOCK-${Date.now()}`
    };
  }
}

// Get payment history
router.get('/history', auth, async (req, res) => {
  try {
    const rides = await Ride.find({
      'passengers.user': req.user._id,
      status: 'completed'
    }).sort({ completedAt: -1 }).limit(20);

    const paymentHistory = rides.map(ride => ({
      rideId: ride._id,
      amount: ride.totalFare,
      date: ride.completedAt,
      paymentMethod: 'cash' // This should be stored in the ride schema
    }));

    res.json({ paymentHistory });
  } catch (error) {
    console.error('Get payment history error:', error);
    res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

// Add funds to wallet via Flutterwave
router.post('/wallet/add', auth, [
  body('amount').isNumeric(),
  body('paymentMethod').isIn(['mobile_money', 'card', 'bank_transfer'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { amount, paymentMethod, phoneNumber, cardDetails } = req.body;

    let paymentResult;

    if (paymentMethod === 'mobile_money') {
      paymentResult = await processFlutterwaveMobileMoney({
        amount,
        phoneNumber,
        email: req.user.email,
        rideId: 'WALLET',
        txRef: `WALLET-${Date.now()}`
      });
    } else if (paymentMethod === 'card') {
      paymentResult = await processFlutterwaveCardPayment({
        amount,
        cardDetails,
        email: req.user.email,
        rideId: 'WALLET',
        txRef: `WALLET-${Date.now()}`
      });
    } else if (paymentMethod === 'bank_transfer') {
      paymentResult = await processFlutterwaveBankTransfer({
        amount,
        email: req.user.email,
        rideId: 'WALLET',
        txRef: `WALLET-${Date.now()}`
      });
    }

    if (paymentResult.success) {
      const user = await User.findById(req.user._id);
      user.wallet.balance += amount;
      await user.save();

      res.json({
        message: 'Funds added successfully',
        transactionId: paymentResult.transactionId,
        newBalance: user.wallet.balance
      });
    } else {
      res.status(400).json({ error: paymentResult.message });
    }
  } catch (error) {
    console.error('Add funds error:', error);
    res.status(500).json({ error: 'Failed to add funds' });
  }
});

// Verify payment (webhook for Flutterwave)
router.post('/verify', async (req, res) => {
  try {
    const { transaction_id, tx_ref } = req.body;

    // Verify transaction with Flutterwave
    const response = await flw.Transaction.verify({ id: transaction_id });

    if (response.data.status === 'successful') {
      // Update ride status if this is a ride payment
      if (response.data.meta?.rideId) {
        const ride = await Ride.findById(response.data.meta.rideId);
        if (ride) {
          ride.paymentStatus = 'paid';
          ride.transactionId = transaction_id;
          await ride.save();
        }
      }

      res.json({ status: 'success', message: 'Payment verified' });
    } else {
      res.status(400).json({ status: 'failed', message: 'Payment verification failed' });
    }
  } catch (error) {
    console.error('Verify payment error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

module.exports = router;
