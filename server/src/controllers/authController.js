const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const { hashSHA256 } = require('../services/cryptoService');
const { supabase, deleteFromStorage, purgeUserAccount, localDb } = require('../services/supabaseService');
const { sendVerificationEmail, sendOtpEmail } = require('../services/emailService');

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_vault_key_2026_change_me_in_production';

// Lightweight in-memory cache for fast user lookup (performance optimization)
const userCache = new Map();
const CACHE_TTL = 30 * 1000; // 30 seconds

function setCachedUser(email, userData) {
  if (!email) return;
  userCache.set(email.toLowerCase().trim(), {
    data: userData,
    expiresAt: Date.now() + CACHE_TTL
  });
}

function getCachedUser(email) {
  if (!email) return null;
  const cached = userCache.get(email.toLowerCase().trim());
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }
  userCache.delete(email.toLowerCase().trim());
  return null;
}

function invalidateCachedUser(email) {
  if (email) userCache.delete(email.toLowerCase().trim());
}

// Utility: Email Validator
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Universal User Fetch (MongoDB Mongoose lean() with Supabase / localDb fallback)
 */
async function findUserByEmail(email) {
  if (!email) return null;
  const cleanEmail = email.toLowerCase().trim();

  // Check fast cache first
  const cached = getCachedUser(cleanEmail);
  if (cached) return cached;

  // 1. Try Mongoose MongoDB with lean() for maximum query speed
  try {
    const mongoUser = await User.findOne({ email: cleanEmail }).lean();
    if (mongoUser) {
      const formatted = {
        id: mongoUser._id.toString(),
        mongoId: mongoUser._id.toString(),
        username: mongoUser.username || cleanEmail.split('@')[0],
        email: mongoUser.email,
        password_hash: mongoUser.password_hash,
        pin_hash: mongoUser.pin_hash || null,
        isVerified: mongoUser.isVerified === true,
        verificationToken: mongoUser.verificationToken || null,
        verificationTokenExpires: mongoUser.verificationTokenExpires || null,
        resetPasswordOtp: mongoUser.resetPasswordOtp || null,
        resetPasswordExpires: mongoUser.resetPasswordExpires || null,
        storage_used: mongoUser.storage_used || 0,
        storage_limit: mongoUser.storage_limit || 524288000,
        created_at: mongoUser.createdAt || new Date().toISOString()
      };
      setCachedUser(cleanEmail, formatted);
      return formatted;
    }
  } catch (err) {
    // Mongoose not connected or failed
  }

  // 2. Try Supabase PostgreSQL
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('email', cleanEmail)
        .limit(1);

      if (!error && data && data.length > 0) {
        const u = data[0];
        const formatted = {
          ...u,
          password_hash: u.password_hash || u.password || '',
          isVerified: u.is_verified === true || u.isVerified === true
        };
        setCachedUser(cleanEmail, formatted);
        return formatted;
      }
    } catch (err) {
      console.warn('Supabase getUserByEmail notice:', err.message);
    }
  }

  // 3. Fallback to local memory/JSON DB
  const localUser = localDb.users.find(u => u.email.toLowerCase().trim() === cleanEmail);
  if (localUser) {
    const formatted = {
      ...localUser,
      isVerified: localUser.isVerified === true
    };
    setCachedUser(cleanEmail, formatted);
    return formatted;
  }

  return null;
}

/**
 * SIGNUP CONTROLLER
 */
const signup = async (req, res) => {
  try {
    const { email, password, pin } = req.body;

    // 1. Validation & Input Sanitization
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    if (!isValidEmail(cleanEmail)) {
      return res.status(400).json({ success: false, message: 'Please provide a valid email address.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    // 2. Check for duplicate user
    const existingUser = await findUserByEmail(cleanEmail);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email address already exists.' });
    }

    // 3. Hash Passwords & PIN securely
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    let pinHash = null;
    if (pin && String(pin).trim() !== '') {
      pinHash = hashSHA256(String(pin).trim());
    }

    // 4. Generate Verification Token (expires in 24 hours)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const defaultUsername = cleanEmail.split('@')[0];

    // 5. Save to MongoDB Mongoose if active
    let newUserRecord = null;
    try {
      const doc = await User.create({
        email: cleanEmail,
        username: defaultUsername,
        password_hash: passwordHash,
        pin_hash: pinHash,
        isVerified: false,
        verificationToken,
        verificationTokenExpires,
        storage_used: 0,
        storage_limit: 524288000
      });
      newUserRecord = {
        id: doc._id.toString(),
        email: cleanEmail,
        username: defaultUsername,
        isVerified: false,
        storage_used: 0,
        storage_limit: 524288000
      };
    } catch (dbErr) {
      console.warn('Mongoose User.create notice:', dbErr.message);
    }

    // Fallback sync to localDb and Supabase
    const fallbackRecord = {
      id: newUserRecord ? newUserRecord.id : crypto.randomUUID(),
      username: defaultUsername,
      email: cleanEmail,
      password_hash: passwordHash,
      pin_hash: pinHash,
      isVerified: false,
      verificationToken,
      verificationTokenExpires,
      storage_used: 0,
      storage_limit: 524288000,
      created_at: new Date().toISOString()
    };
    localDb.users = localDb.users.filter(u => u.email.toLowerCase().trim() !== cleanEmail);
    localDb.users.push(fallbackRecord);

    if (supabase) {
      try {
        await supabase.from('users').insert([{
          id: fallbackRecord.id,
          username: defaultUsername,
          email: cleanEmail,
          password_hash: passwordHash,
          is_verified: false,
          storage_used: 0,
          storage_limit: 524288000
        }]);
      } catch (sErr) {}
    }

    invalidateCachedUser(cleanEmail);

    // 6. Dispatch Verification Email (live SMTP / dev mode)
    await sendVerificationEmail(cleanEmail, verificationToken, req);

    return res.status(201).json({
      success: true,
      isVerified: false,
      message: 'Account created successfully! Please check your email to verify your account before logging in.',
      email: cleanEmail
    });
  } catch (error) {
    console.error('Signup Controller Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error during registration.' });
  }
};

/**
 * LOGIN CONTROLLER (Blocks unverified users)
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await findUserByEmail(cleanEmail);

    if (!user) {
      return res.status(400).json({ success: false, message: 'Invalid email or password.' });
    }

    // Compare Password Hash
    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Invalid email or password.' });
    }

    // BLOCK LOGIN IF NOT VERIFIED
    if (user.isVerified !== true) {
      return res.status(403).json({
        success: false,
        isVerified: false,
        message: 'Your email address is not verified yet. Please check your inbox for the verification link.',
        email: cleanEmail
      });
    }

    // Generate JWT Token
    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        storage_used: user.storage_used || 0,
        storage_limit: user.storage_limit || 524288000,
        isVerified: true,
        hasPin: Boolean(user.pin_hash)
      }
    });
  } catch (error) {
    console.error('Login Controller Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error during login.' });
  }
};

/**
 * EMAIL VERIFICATION CONTROLLER (http://localhost:5000/api/auth/verify-email?token=TOKEN)
 */
const verifyEmail = async (req, res) => {
  try {
    const token = req.query.token || req.body.token;

    if (!token) {
      if (req.accepts('html')) {
        return res.status(400).send(renderVerificationHtml(false, 'Verification token is missing.'));
      }
      return res.status(400).json({ success: false, message: 'Verification token is missing.' });
    }

    let userFound = null;

    // 1. Check Mongoose MongoDB
    try {
      userFound = await User.findOne({
        verificationToken: token,
        verificationTokenExpires: { $gt: new Date() }
      });
      if (userFound) {
        userFound.isVerified = true;
        userFound.verificationToken = null;
        userFound.verificationTokenExpires = null;
        await userFound.save();
      }
    } catch (err) {}

    // 2. Check localDb & Supabase fallback
    if (!userFound) {
      const localU = localDb.users.find(
        u => u.verificationToken === token && new Date(u.verificationTokenExpires) > new Date()
      );
      if (localU) {
        localU.isVerified = true;
        localU.verificationToken = null;
        localU.verificationTokenExpires = null;
        userFound = localU;
      }
    }

    if (!userFound) {
      if (req.accepts('html')) {
        return res.status(400).send(renderVerificationHtml(false, 'Invalid or expired verification link. Please request a new verification email.'));
      }
      return res.status(400).json({ success: false, message: 'Invalid or expired verification link.' });
    }

    invalidateCachedUser(userFound.email);

    if (req.accepts('html')) {
      return res.send(renderVerificationHtml(true, 'Your email has been verified successfully! You can now log into your SecureVault account.'));
    }

    return res.json({
      success: true,
      message: 'Email verified successfully. You may now log in.'
    });
  } catch (error) {
    console.error('Verify Email Error:', error);
    if (req.accepts('html')) {
      return res.status(500).send(renderVerificationHtml(false, 'Server error processing verification.'));
    }
    return res.status(500).json({ success: false, message: 'Internal server error during email verification.' });
  }
};

/**
 * RESEND VERIFICATION EMAIL CONTROLLER
 */
const resendVerification = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await findUserByEmail(cleanEmail);

    if (!user) {
      // Return success to avoid user enumeration
      return res.json({
        success: true,
        message: 'If an unverified account with this email exists, a verification link has been sent.'
      });
    }

    if (user.isVerified === true) {
      return res.status(400).json({
        success: false,
        message: 'This email address is already verified. You can log in directly.'
      });
    }

    // Generate new token & expiry
    const newToken = crypto.randomBytes(32).toString('hex');
    const newExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Update in Mongo
    try {
      await User.updateOne(
        { email: cleanEmail },
        { verificationToken: newToken, verificationTokenExpires: newExpires }
      );
    } catch (e) {}

    // Update in localDb
    const localU = localDb.users.find(u => u.email.toLowerCase().trim() === cleanEmail);
    if (localU) {
      localU.verificationToken = newToken;
      localU.verificationTokenExpires = newExpires;
    }

    invalidateCachedUser(cleanEmail);

    // Send email
    await sendVerificationEmail(cleanEmail, newToken, req);

    return res.json({
      success: true,
      message: 'Verification email has been sent! Please check your inbox and spam folder.'
    });
  } catch (error) {
    console.error('Resend Verification Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error resending verification email.' });
  }
};

/**
 * QUICK UNLOCK PIN CONTROLLER
 */
const quickUnlockPin = async (req, res) => {
  try {
    const { email, pin } = req.body;
    if (!email || !pin) {
      return res.status(400).json({ success: false, message: 'Email and PIN are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await findUserByEmail(cleanEmail);

    if (!user || !user.pin_hash) {
      return res.status(400).json({ success: false, message: 'Invalid PIN or email.' });
    }

    if (user.isVerified !== true) {
      return res.status(403).json({
        success: false,
        isVerified: false,
        message: 'Your email address is not verified yet.',
        email: cleanEmail
      });
    }

    const providedPinHash = hashSHA256(String(pin).trim());
    if (providedPinHash !== user.pin_hash) {
      return res.status(400).json({ success: false, message: 'Incorrect Security PIN.' });
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        storage_used: user.storage_used || 0,
        storage_limit: user.storage_limit || 524288000,
        isVerified: true,
        hasPin: true
      }
    });
  } catch (error) {
    console.error('Quick Unlock PIN Error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
};

/**
 * GET CURRENT USER ME CONTROLLER
 */
const getMe = async (req, res) => {
  try {
    const user = await findUserByEmail(req.user.email);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    return res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        storage_used: user.storage_used || 0,
        storage_limit: user.storage_limit || 524288000,
        isVerified: user.isVerified === true,
        hasPin: Boolean(user.pin_hash)
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
};

/**
 * PIN VERIFY CONTROLLER
 */
const verifyPin = async (req, res) => {
  try {
    const { pin } = req.body;
    const user = await findUserByEmail(req.user.email);

    if (!user || !user.pin_hash) {
      return res.json({ unlocked: false, message: 'No PIN set for user.' });
    }

    const inputHash = hashSHA256(String(pin).trim());
    if (inputHash === user.pin_hash) {
      return res.json({ unlocked: true });
    } else {
      return res.status(400).json({ unlocked: false, message: 'Incorrect PIN' });
    }
  } catch (error) {
    return res.status(500).json({ unlocked: false, message: 'Server error' });
  }
};

/**
 * SET PIN CONTROLLER
 */
const setPin = async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || String(pin).trim() === '') {
      return res.status(400).json({ success: false, message: 'PIN cannot be empty.' });
    }

    const pinHash = hashSHA256(String(pin).trim());
    const cleanEmail = req.user.email.toLowerCase().trim();

    // Update Mongo
    try {
      await User.updateOne({ email: cleanEmail }, { pin_hash: pinHash });
    } catch (e) {}

    // Update localDb
    const localU = localDb.users.find(u => u.email.toLowerCase().trim() === cleanEmail);
    if (localU) {
      localU.pin_hash = pinHash;
    }

    invalidateCachedUser(cleanEmail);

    return res.json({ success: true, message: 'PIN updated successfully.' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Failed to update PIN.' });
  }
};

/**
 * PASSWORD RESET REQUEST OTP
 */
const requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required.' });

    const cleanEmail = email.toLowerCase().trim();
    const user = await findUserByEmail(cleanEmail);

    if (!user) {
      return res.json({ success: true, message: 'If the email exists, an OTP code has been sent.' });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    // Save OTP
    try {
      await User.updateOne({ email: cleanEmail }, { resetPasswordOtp: otpCode, resetPasswordExpires: otpExpires });
    } catch (e) {}

    const localU = localDb.users.find(u => u.email.toLowerCase().trim() === cleanEmail);
    if (localU) {
      localU.resetPasswordOtp = otpCode;
      localU.resetPasswordExpires = otpExpires;
    }

    await sendOtpEmail(cleanEmail, otpCode);

    return res.json({
      success: true,
      message: 'Password reset OTP code sent to your email.'
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Server error requesting password reset.' });
  }
};

/**
 * PASSWORD RESET CONFIRM OTP
 */
const confirmPasswordReset = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await findUserByEmail(cleanEmail);

    if (!user || user.resetPasswordOtp !== String(otp).trim()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP code.' });
    }

    if (new Date(user.resetPasswordExpires) < new Date()) {
      return res.status(400).json({ success: false, message: 'OTP code has expired.' });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update Mongo
    try {
      await User.updateOne(
        { email: cleanEmail },
        { password_hash: passwordHash, resetPasswordOtp: null, resetPasswordExpires: null }
      );
    } catch (e) {}

    // Update localDb
    const localU = localDb.users.find(u => u.email.toLowerCase().trim() === cleanEmail);
    if (localU) {
      localU.password_hash = passwordHash;
      localU.resetPasswordOtp = null;
      localU.resetPasswordExpires = null;
    }

    invalidateCachedUser(cleanEmail);

    return res.json({ success: true, message: 'Password reset successfully. You can now log in.' });
  } catch (err) {
    return res.status(500).json({ success: false, message: 'Failed to reset password.' });
  }
};

/**
 * Helper to render responsive HTML verification page for direct browser clicks
 */
function renderVerificationHtml(isSuccess, message) {
  const title = isSuccess ? 'Email Verified!' : 'Verification Failed';
  const icon = isSuccess ? '✅' : '❌';
  const color = isSuccess ? '#10B981' : '#EF4444';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - SecureVault</title>
  <style>
    body {
      margin: 0; padding: 0; background-color: #0B0F19; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      display: flex; align-items: center; justify-content: center; min-height: 100vh; color: #F8FAFC;
    }
    .card {
      background-color: #111827; border: 1px solid #1F2937; border-radius: 24px; padding: 40px; text-align: center;
      max-width: 440px; width: 90%; box-shadow: 0 20px 40px rgba(0,0,0,0.5);
    }
    .icon { font-size: 54px; margin-bottom: 16px; }
    h1 { margin: 0 0 12px 0; font-size: 24px; font-weight: 700; color: ${color}; }
    p { margin: 0 0 28px 0; font-size: 15px; color: #94A3B8; line-height: 1.6; }
    .btn {
      display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #06B6D4 0%, #3B82F6 100%);
      color: #FFF; font-weight: 600; text-decoration: none; border-radius: 12px; transition: transform 0.2s;
    }
    .btn:hover { transform: translateY(-2px); }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${icon}</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/" class="btn">Proceed to App</a>
  </div>
</body>
</html>
  `;
}

module.exports = {
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
};
