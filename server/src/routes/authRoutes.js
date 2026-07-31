const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { hashSHA256 } = require('../services/cryptoService');
const { supabase, isSupabaseConfigured, deleteFromStorage, purgeUserAccount, localDb } = require('../services/supabaseService');
const { sendOtpEmail } = require('../services/emailService');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_vault_key_2026_change_me_in_production';

/**
 * Helper to get user by email with column alias compatibility
 */
async function getUserByEmail(email) {
  const cleanEmail = email.toLowerCase().trim();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .ilike('email', cleanEmail)
        .limit(1);

      if (!error && data && data.length > 0) {
        const u = data[0];
        return {
          ...u,
          password_hash: u.password_hash || u.password || ''
        };
      }
    } catch (err) {
      console.warn('Supabase getUserByEmail error, falling back to localDb:', err.message);
    }
  }
  
  return localDb.users.find(u => u.email.toLowerCase().trim() === cleanEmail) || null;
}

/**
 * Helper to create user with column & foreign key fallback support
 */
async function createUser(email, passwordHash, pinHash = null) {
  const cleanEmail = email.toLowerCase().trim();
  const defaultUsername = cleanEmail.split('@')[0];

  const newUser = {
    id: crypto.randomUUID(),
    username: defaultUsername,
    email: cleanEmail,
    password_hash: passwordHash,
    pin_hash: pinHash,
    storage_used: 0,
    created_at: new Date().toISOString()
  };

  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('users')
        .insert([newUser])
        .select('*')
        .single();

      if (error) {
        console.warn('Supabase insert user error:', error.message);
        
        // If password_hash column is missing in Supabase table, try inserting with 'password' column
        if (error.message.includes('password_hash')) {
          const fallbackUser = {
            id: newUser.id,
            username: defaultUsername,
            email: cleanEmail,
            password: passwordHash,
            created_at: newUser.created_at
          };
          const { data: d2, error: e2 } = await supabase.from('users').insert([fallbackUser]).select('*').single();
          if (!e2 && d2) return { ...d2, password_hash: passwordHash };
        }

        // If foreign key constraint users_id_fkey blocks direct insertion without auth.users, fallback gracefully
        if (error.message.includes('users_id_fkey') || error.message.includes('foreign key constraint')) {
          console.warn('Foreign key constraint users_id_fkey active on Supabase. Saving user to memory state for resilient operation.');
          localDb.users.push(newUser);
          return newUser;
        }

        throw new Error(error.message);
      }
      return data;
    } catch (supabaseErr) {
      console.error('Supabase createUser notice, saving to local memory state:', supabaseErr.message);
      localDb.users.push(newUser);
      return newUser;
    }
  } else {
    localDb.users.push(newUser);
    return newUser;
  }
}

/**
 * Helper to update user
 */
async function updateUser(userId, updates) {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select('*')
        .single();
      if (!error) return data;
    } catch (e) {
      console.warn('Supabase updateUser warning:', e.message);
    }
  }

  const idx = localDb.users.findIndex(u => u.id === userId);
  if (idx !== -1) {
    localDb.users[idx] = { ...localDb.users[idx], ...updates };
    return localDb.users[idx];
  }
  return null;
}

// ----------------------------------------------------
// 1. USER SIGNUP
// ----------------------------------------------------
router.post('/signup', async (req, res) => {
  try {
    const { email, password, pin } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters long.' });
    }

    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const pinHash = pin ? hashSHA256(pin) : null;

    const user = await createUser(email, passwordHash, pinHash);

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({
      success: true,
      message: 'SecureVault account created successfully.',
      token,
      user: {
        id: user.id,
        email: user.email,
        storage_used: user.storage_used || 0,
        has_pin: Boolean(user.pin_hash)
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error during signup.' });
  }
});

// ----------------------------------------------------
// 2. USER LOGIN
// ----------------------------------------------------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        storage_used: user.storage_used || 0,
        has_pin: Boolean(user.pin_hash)
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ success: false, message: error.message || 'Server error during login.' });
  }
});

// ----------------------------------------------------
// 3. SMART PIN QUICK UNLOCK
// ----------------------------------------------------
router.post('/pin/quick-unlock', async (req, res) => {
  try {
    const { email, pin } = req.body;
    if (!email || !pin || String(pin).length !== 4) {
      return res.status(400).json({ success: false, message: 'Email and 4-digit PIN are required.' });
    }

    const user = await getUserByEmail(email);
    if (!user || !user.pin_hash) {
      return res.status(401).json({ success: false, message: 'No PIN set for this account. Please log in with password.' });
    }

    const inputPinHash = hashSHA256(pin);
    if (inputPinHash !== user.pin_hash) {
      return res.status(401).json({ success: false, message: 'Incorrect 4-digit PIN.' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        storage_used: user.storage_used || 0,
        has_pin: true
      }
    });
  } catch (error) {
    console.error('Smart PIN unlock error:', error);
    res.status(500).json({ success: false, message: 'Failed to verify PIN.' });
  }
});

// ----------------------------------------------------
// 4. SET / UPDATE SECRET PIN
// ----------------------------------------------------
router.post('/pin', authMiddleware, async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin || String(pin).length !== 4) {
      return res.status(400).json({ success: false, message: 'A 4-digit numeric PIN is required.' });
    }

    const pinHash = hashSHA256(pin);
    await updateUser(req.user.id, { pin_hash: pinHash });

    res.json({ success: true, message: 'Smart 4-digit PIN updated successfully.' });
  } catch (error) {
    console.error('Set PIN error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to update PIN.' });
  }
});

// ----------------------------------------------------
// 5. VERIFY PIN
// ----------------------------------------------------
router.post('/pin/verify', authMiddleware, async (req, res) => {
  try {
    const { pin } = req.body;
    if (!pin) {
      return res.json({ success: false, unlocked: false });
    }

    let user = null;
    if (supabase) {
      const { data } = await supabase.from('users').select('pin_hash').eq('id', req.user.id).single();
      user = data;
    } else {
      user = localDb.users.find(u => u.id === req.user.id);
    }

    if (!user || !user.pin_hash) {
      return res.json({ success: false, unlocked: false });
    }

    const inputPinHash = hashSHA256(pin);
    const isCorrect = inputPinHash === user.pin_hash;

    res.json({
      success: isCorrect,
      unlocked: isCorrect
    });
  } catch (error) {
    console.error('PIN verification error:', error);
    res.json({ success: false, unlocked: false });
  }
});

// ----------------------------------------------------
// 6. FORGOT PASSWORD
// ----------------------------------------------------
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address is required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const user = await getUserByEmail(cleanEmail);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'No account found with this email address. Please Register first.'
      });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = hashSHA256(otp);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    console.log(`🔑 Generated OTP for ${cleanEmail}: [ ${otp} ]`);

    await updateUser(user.id, {
      otp_hash: otpHash,
      otp_expires_at: expiresAt.toISOString()
    });

    if (supabase) {
      try {
        await supabase.from('otps').delete().eq('email', cleanEmail);
        await supabase.from('otps').insert([{
          email: cleanEmail,
          otp_hash: otpHash,
          expires_at: expiresAt.toISOString()
        }]);
      } catch (e) {}
    }

    localDb.otps = localDb.otps.filter(o => o.email !== cleanEmail);
    localDb.otps.push({
      id: crypto.randomUUID(),
      email: cleanEmail,
      otp_hash: otpHash,
      expires_at: expiresAt
    });

    const emailResult = await sendOtpEmail(cleanEmail, otp);

    res.json({
      success: true,
      message: 'OTP has been sent to your email (expires in 5 minutes).',
      dev_otp: emailResult.devMode ? otp : undefined
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Error delivering OTP email.' });
  }
});

// ----------------------------------------------------
// 7. RESET PASSWORD
// ----------------------------------------------------
router.post('/reset-password', async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters long.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanOtp = String(otp).trim();
    const otpHash = hashSHA256(cleanOtp);
    const now = new Date();

    const user = await getUserByEmail(cleanEmail);
    if (!user) {
      return res.status(400).json({ success: false, message: 'User account not found.' });
    }

    let validOtp = false;

    if (user.otp_hash) {
      const isHashMatch = user.otp_hash === otpHash;
      const isNotExpired = user.otp_expires_at ? new Date(user.otp_expires_at) >= now : true;
      if (isHashMatch && isNotExpired) {
        validOtp = true;
      }
    }

    if (!validOtp && supabase) {
      try {
        const { data } = await supabase
          .from('otps')
          .select('*')
          .eq('email', cleanEmail)
          .order('created_at', { ascending: false });

        if (data && data.length > 0) {
          const match = data.find(o => o.otp_hash === otpHash && new Date(o.expires_at) >= now);
          if (match) validOtp = true;
        }
      } catch (e) {}
    }

    if (!validOtp) {
      const matchingOtp = localDb.otps.find(o =>
        o.email.toLowerCase().trim() === cleanEmail &&
        o.otp_hash === otpHash &&
        new Date(o.expires_at) >= now
      );
      if (matchingOtp) validOtp = true;
    }

    if (!validOtp) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP code.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await updateUser(user.id, {
      password_hash: passwordHash,
      otp_hash: null,
      otp_expires_at: null
    });

    if (supabase) {
      try {
        await supabase.from('otps').delete().eq('email', cleanEmail);
      } catch (e) {}
    }
    localDb.otps = localDb.otps.filter(o => o.email !== cleanEmail);

    res.json({ success: true, message: 'Password reset successfully! You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ success: false, message: 'Error resetting password.' });
  }
});

// ----------------------------------------------------
// 8. GET CURRENT USER PROFILE
// ----------------------------------------------------
router.get('/me', authMiddleware, async (req, res) => {
  try {
    let user = null;
    if (supabase) {
      const { data } = await supabase.from('users').select('id, email, storage_used, pin_hash').eq('id', req.user.id).single();
      user = data;
    } else {
      user = localDb.users.find(u => u.id === req.user.id);
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'User profile not found.' });
    }

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        storage_used: Number(user.storage_used || 0),
        has_pin: Boolean(user.pin_hash)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ----------------------------------------------------
// 9. COMPLETE PERMANENT ACCOUNT & DATA PURGE HANDLER
// ----------------------------------------------------
const handleAccountDeletion = async (req, res) => {
  try {
    const userId = req.user.id;
    const userEmail = req.user.email ? req.user.email.toLowerCase().trim() : '';

    console.log(`🔥 Starting complete account deletion purge for user: ${userEmail} (${userId})`);

    await purgeUserAccount(userId, userEmail);

    res.json({
      success: true,
      message: 'Your account and all associated encrypted files/photos have been permanently deleted.'
    });
  } catch (error) {
    console.error('Fatal account delete error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to delete user account.' });
  }
};

router.delete('/account', authMiddleware, handleAccountDeletion);
router.delete('/account/delete', authMiddleware, handleAccountDeletion);
router.post('/account/delete', authMiddleware, handleAccountDeletion);

module.exports = router;
