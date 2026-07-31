const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true // Fast lookup index
    },
    username: {
      type: String,
      trim: true
    },
    password_hash: {
      type: String,
      required: [true, 'Password is required']
    },
    pin_hash: {
      type: String,
      default: null
    },
    isVerified: {
      type: Boolean,
      default: false
    },
    verificationToken: {
      type: String,
      default: null,
      index: true // Fast verification lookup index
    },
    verificationTokenExpires: {
      type: Date,
      default: null
    },
    resetPasswordOtp: {
      type: String,
      default: null
    },
    resetPasswordExpires: {
      type: Date,
      default: null
    },
    storage_used: {
      type: Number,
      default: 0
    },
    storage_limit: {
      type: Number,
      default: 524288000 // 500 MB default quota
    }
  },
  {
    timestamps: true
  }
);

// High-speed compound & single indexes for performance
userSchema.index({ email: 1 });
userSchema.index({ verificationToken: 1 });

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
