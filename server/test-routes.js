const express = require('express');
const authRoutes = require('./src/routes/authRoutes');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// Print registered auth routes
console.log('--- Registered Auth Routes ---');
authRoutes.stack.forEach(r => {
  if (r.route) {
    console.log(`${Object.keys(r.route.methods).join(',').toUpperCase()} /api/auth${r.route.path}`);
  }
});
console.log('------------------------------');
