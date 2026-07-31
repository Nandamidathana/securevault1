const express = require('express');
const authMiddleware = require('../middleware/authMiddleware');
const { authLimiter, verificationLimiter } = require('../middleware/rateLimiter');
const {
  signup,
  login,
  verifyEmail,
  resendVerification,
  quickUnlockPin,
  getMe,
  verifyPin,
  setPin,
  requestPasswordReset,
  confirmPasswordReset
} = require('../controllers/authController');

const router = express.Router();

// Public Authentication Endpoints (Rate Limited)
router.post('/signup', authLimiter, signup);
router.post('/login', authLimiter, login);

// Email Verification Endpoints
router.get('/verify-email', verifyEmail);
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', verificationLimiter, resendVerification);

// Smart PIN Quick Unlock (Public with email & PIN)
router.post('/pin/quick-unlock', quickUnlockPin);

// Password Reset OTP Endpoints
router.post('/password-reset/request', requestPasswordReset);
router.post('/password-reset/confirm', confirmPasswordReset);

// Authenticated User Endpoints
router.get('/me', authMiddleware, getMe);
router.post('/pin/verify', authMiddleware, verifyPin);
router.post('/pin', authMiddleware, setPin);

module.exports = router;
