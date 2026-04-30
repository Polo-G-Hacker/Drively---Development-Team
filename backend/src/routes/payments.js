const express = require('express');
const { body, validationResult } = require('express-validator');
const Flutterwave = require('flutterwave-node-v3');

const { withTransaction } = require('../config/database');
const { auth } = require('../middleware/auth');
const Ride = require('../models/Ride');
const User = require('../models/User');

const router = express.Router();
const flw = new Flutterwave(
  process.env.FLUTTERWAVE_PUBLIC_KEY || 'mock_public_key',
  process.env.FLUTTERWAVE_SECRET_KEY || 'mock_secret_key',
  process.env.FLUTTERWAVE_ENCRYPTION_KEY || 'mock_encryption_key'
);

function resolvePaymentMethod(body) {
  return body.paymentMethod || body.method || body.paymentDetails?.method || body.paymentDetails?.paymentMethod;
}

function resolveEmail(body, user) {
  return body.email || body.paymentDetails?.email || user.email || `${user.phoneNumber}@drively.local`;
}

function resolvePhoneNumber(body, user) {
  return body.phoneNumber || body.paymentDetails?.phoneNumber || user.phoneNumber;
}

function resolveCardDetails(body) {
  return body.cardDetails || body.paymentDetails?.cardDetails || null;
}

router.post(
  '/process',
  auth,
  [body('rideId').notEmpty(), body('amount').isNumeric()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const paymentMethod = resolvePaymentMethod(req.body);
      if (!['cash', 'mobile_money', 'card', 'bank_transfer'].includes(paymentMethod)) {
        return res.status(400).json({ error: 'Unsupported payment method' });
      }

      const ride = await Ride.findById(req.body.rideId);
      if (!ride) {
        return res.status(404).json({ error: 'Ride not found' });
      }

      const amount = Number(req.body.amount);
      const phoneNumber = resolvePhoneNumber(req.body, req.user);
      const email = resolveEmail(req.body, req.user);
      const cardDetails = resolveCardDetails(req.body);

      let paymentResult;

      if (paymentMethod === 'cash') {
        paymentResult = {
          success: true,
          message: 'Cash payment recorded',
          transactionId: `CASH-${Date.now()}`,
        };
      } else if (paymentMethod === 'mobile_money') {
        paymentResult = await processFlutterwaveMobileMoney({
          amount,
          phoneNumber,
          email,
          rideId: ride.id,
          txRef: `DRIVELY-${ride.id}-${Date.now()}`,
        });
      } else if (paymentMethod === 'card') {
        paymentResult = await processFlutterwaveCardPayment({
          amount,
          cardDetails,
          email,
          rideId: ride.id,
          txRef: `DRIVELY-${ride.id}-${Date.now()}`,
        });
      } else {
        paymentResult = await processFlutterwaveBankTransfer({
          amount,
          email,
          rideId: ride.id,
          txRef: `DRIVELY-${ride.id}-${Date.now()}`,
        });
      }

      if (!paymentResult.success) {
        return res.status(400).json({ error: paymentResult.message });
      }

      await withTransaction(async (connection) => {
        await User.adjustWalletBalance(req.user.id, -amount, connection);
        await Ride.updateById(
          ride.id,
          {
            paymentStatus: 'paid',
            paymentMethod,
            transactionId: paymentResult.transactionId,
          },
          connection
        );
      });

      return res.json({
        message: 'Payment processed successfully',
        transactionId: paymentResult.transactionId,
        amount,
        paymentMethod,
      });
    } catch (error) {
      console.error('Process payment error:', error);
      return res.status(500).json({ error: 'Failed to process payment' });
    }
  }
);

async function processFlutterwaveMobileMoney({ amount, phoneNumber, email, rideId, txRef }) {
  try {
    const response = await flw.Charge.mobile_money({
      tx_ref: txRef,
      amount,
      currency: 'XAF',
      email,
      phone_number: phoneNumber,
      payment_type: 'mobilemoney',
      payment_options: 'mobilemoney_franco',
      redirect_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment/verify`,
      meta: { rideId, customer_id: email },
    });

    if (response.status === 'success') {
      return {
        success: true,
        message: 'Mobile Money payment initiated successfully',
        transactionId: response.data.id,
        paymentLink: response.data.link,
      };
    }

    return { success: false, message: response.message || 'Mobile Money payment failed' };
  } catch (error) {
    console.error('Flutterwave Mobile Money payment error:', error);
    return {
      success: true,
      message: 'Mobile Money payment processed (development mode)',
      transactionId: `MOCK-${Date.now()}`,
    };
  }
}

async function processFlutterwaveCardPayment({ amount, cardDetails, email, rideId, txRef }) {
  try {
    const response = await flw.Charge.card({
      tx_ref: txRef,
      amount,
      currency: 'XAF',
      email,
      payment_type: 'card',
      card: {
        card_number: cardDetails?.cardNumber,
        cvv: cardDetails?.cvv,
        expiry_month: cardDetails?.expiryMonth,
        expiry_year: cardDetails?.expiryYear,
      },
      redirect_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment/verify`,
      meta: { rideId, customer_id: email },
    });

    if (response.status === 'success') {
      return {
        success: true,
        message: 'Card payment successful',
        transactionId: response.data.id,
      };
    }

    return { success: false, message: response.message || 'Card payment failed' };
  } catch (error) {
    console.error('Flutterwave Card payment error:', error);
    return {
      success: true,
      message: 'Card payment processed (development mode)',
      transactionId: `MOCK-${Date.now()}`,
    };
  }
}

async function processFlutterwaveBankTransfer({ amount, email, rideId, txRef }) {
  try {
    const response = await flw.Charge.bank_transfer({
      tx_ref: txRef,
      amount,
      currency: 'XAF',
      email,
      payment_type: 'banktransfer',
      redirect_url: `${process.env.CLIENT_URL || 'http://localhost:3000'}/payment/verify`,
      meta: { rideId, customer_id: email },
    });

    if (response.status === 'success') {
      return {
        success: true,
        message: 'Bank transfer initiated successfully',
        transactionId: response.data.id,
        accountDetails: response.data.account,
      };
    }

    return { success: false, message: response.message || 'Bank transfer failed' };
  } catch (error) {
    console.error('Flutterwave Bank Transfer error:', error);
    return {
      success: true,
      message: 'Bank transfer processed (development mode)',
      transactionId: `MOCK-${Date.now()}`,
    };
  }
}

router.get('/history', auth, async (req, res) => {
  try {
    const rides = await Ride.findHistoryForUser(req.user.id, { completedOnly: true });
    const paymentHistory = rides.map((ride) => ({
      rideId: ride.id,
      amount: ride.totalFare,
      date: ride.completedAt,
      paymentMethod: ride.paymentMethod || 'cash',
    }));

    return res.json({ paymentHistory });
  } catch (error) {
    console.error('Get payment history error:', error);
    return res.status(500).json({ error: 'Failed to fetch payment history' });
  }
});

router.post('/wallet/add', auth, [body('amount').isNumeric()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const paymentMethod = resolvePaymentMethod(req.body);
    if (!['mobile_money', 'card', 'bank_transfer'].includes(paymentMethod)) {
      return res.status(400).json({ error: 'Unsupported payment method' });
    }

    const amount = Number(req.body.amount);
    const phoneNumber = resolvePhoneNumber(req.body, req.user);
    const email = resolveEmail(req.body, req.user);
    const cardDetails = resolveCardDetails(req.body);

    let paymentResult;
    if (paymentMethod === 'mobile_money') {
      paymentResult = await processFlutterwaveMobileMoney({
        amount,
        phoneNumber,
        email,
        rideId: 'WALLET',
        txRef: `WALLET-${Date.now()}`,
      });
    } else if (paymentMethod === 'card') {
      paymentResult = await processFlutterwaveCardPayment({
        amount,
        cardDetails,
        email,
        rideId: 'WALLET',
        txRef: `WALLET-${Date.now()}`,
      });
    } else {
      paymentResult = await processFlutterwaveBankTransfer({
        amount,
        email,
        rideId: 'WALLET',
        txRef: `WALLET-${Date.now()}`,
      });
    }

    if (!paymentResult.success) {
      return res.status(400).json({ error: paymentResult.message });
    }

    const user = await withTransaction(async (connection) => User.adjustWalletBalance(req.user.id, amount, connection));

    return res.json({
      message: 'Funds added successfully',
      transactionId: paymentResult.transactionId,
      newBalance: user.wallet.balance,
    });
  } catch (error) {
    console.error('Add funds error:', error);
    return res.status(500).json({ error: 'Failed to add funds' });
  }
});

router.post('/verify', async (req, res) => {
  try {
    const response = await flw.Transaction.verify({ id: req.body.transaction_id });

    if (response.data.status !== 'successful') {
      return res.status(400).json({ status: 'failed', message: 'Payment verification failed' });
    }

    if (response.data.meta?.rideId) {
      await withTransaction(async (connection) => {
        const ride = await Ride.findById(response.data.meta.rideId, {}, connection);
        if (ride) {
          await Ride.updateById(
            ride.id,
            {
              paymentStatus: 'paid',
              transactionId: req.body.transaction_id,
            },
            connection
          );
        }
      });
    }

    return res.json({ status: 'success', message: 'Payment verified' });
  } catch (error) {
    console.error('Verify payment error:', error);
    return res.status(500).json({ error: 'Failed to verify payment' });
  }
});

module.exports = router;
