require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const authRoutes = require('./routes/authRoutes');
const fileRoutes = require('./routes/fileRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

app.use(cors({
  origin: '*', // Allow client connections
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body Parsing Middlewares
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health Check Route
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'SecureVault Zero-Knowledge Server',
    timestamp: new Date().toISOString()
  });
});

// Route Registration
app.use('/api/auth', authRoutes);
app.use('/api/files', fileRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found.' });
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Express Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error'
  });
});

app.listen(PORT, () => {
  console.log(`
  ======================================================
  🔐 SecureVault Zero-Knowledge Backend Running!
  ------------------------------------------------------
  ► Server URL: http://localhost:${PORT}
  ► Environment: ${process.env.NODE_ENV || 'development'}
  ======================================================
  `);
});
