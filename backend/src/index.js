require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

// Raw body for Stripe webhook
app.use('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }));

// Standard middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/plans', require('./routes/plans'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/kiosk', require('./routes/kiosk'));
app.use('/api/payments', require('./routes/payments'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/tracking', require('./routes/tracking'));
app.use('/api/settings', require('./routes/settings'));

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'ok', timestamp: new Date() }));

// 404
app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Shuttle API running on port ${PORT}`);
});
