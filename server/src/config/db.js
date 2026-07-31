const mongoose = require('mongoose');

/**
 * Connect to MongoDB database for production & live deployments.
 * Supports auto-reconnect, indexing, and connection pool optimization.
 */
const connectDB = async () => {
  const mongoURI = process.env.MONGO_URI || process.env.MONGODB_URI;

  if (!mongoURI) {
    console.warn('⚠️ MONGO_URI is not defined in environment variables.');
    console.warn('👉 Operating with Supabase / localDb storage fallback.');
    return false;
  }

  try {
    const conn = await mongoose.connect(mongoURI, {
      maxPoolSize: 10, // Maintain up to 10 socket connections for high concurrency
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of hanging
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    });

    console.log(`✅ MongoDB Connected Live: ${conn.connection.host}`);
    return true;
  } catch (error) {
    console.error(`❌ MongoDB Connection Failure: ${error.message}`);
    console.warn('⚠️ Falling back to Supabase / localDb storage layer.');
    return false;
  }
};

module.exports = connectDB;
