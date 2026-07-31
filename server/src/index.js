require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const connectDB = require('./config/db');
const { apiLimiter } = require('./middleware/rateLimiter');
const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Connect MongoDB Database (Live & Local support)
connectDB();

// Gzip & Deflate Compression Middleware for Backend Speed Optimization
app.use(compression({
  threshold: 1024, // Compress responses > 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    return compression.filter(req, res);
  }
}));

// Helmet Security Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  contentSecurityPolicy: false // Disable CSP restrictions for API server
}));

// CORS Configuration (Production & Development support)
const allowedOrigins = process.env.CLIENT_URL 
  ? process.env.CLIENT_URL.split(',').map(url => url.trim()) 
  : '*';

app.use(cors({
  origin: allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  credentials: true
}));

// Global API Rate Limiting
app.use('/api', apiLimiter);

// Body Parsing Middlewares with 50MB payload limits
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Server Telemetry & Health Check Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SecureVault Zero-Knowledge Production Server',
    environment: process.env.NODE_ENV || 'development',
    uptime: `${Math.floor(process.uptime())}s`,
    timestamp: new Date().toISOString()
  });
});

// Route Registration
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);

// 404 Route Not Found Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'API Route not found.' });
});

// Global Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('💥 Unhandled Express Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

app.listen(PORT, () => {
  console.log(`
  ======================================================
  🔐 SecureVault Zero-Knowledge Production Backend Ready!
  ------------------------------------------------------
  ► Server URL: http://localhost:${PORT}
  ► Environment: ${process.env.NODE_ENV || 'development'}
  ► Compression: Enabled (gzip/deflate)
  ► Rate Limiting: Active
  ======================================================
  `);
});
