const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// POST /api/tracking — Traccar posts GPS data here
router.post('/', async (req, res) => {
  const body = req.body;
  // Support Traccar osmand format and JSON body format
  const deviceId = body.id || body.device_id || req.query.id || 'unknown';
  const lat = parseFloat(body.lat || body.latitude);
  const lon = parseFloat(body.lon || body.longitude);
  const speed = parseFloat(body.speed || 0);
  const heading = parseFloat(body.bearing || body.heading || 0);
  const timestamp = body.timestamp
    ? new Date(parseInt(body.timestamp) * 1000)
    : body.fixTime
    ? new Date(body.fixTime)
    : new Date();

  if (isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: 'Invalid lat/lon' });
  }

  try {
    await db.query(
      `INSERT INTO tracking_data (device_id, latitude, longitude, speed, heading, timestamp, raw_payload)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [deviceId, lat, lon, speed, heading, timestamp, JSON.stringify(body)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Tracking insert error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tracking/live — latest position per device
router.get('/live', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT ON (device_id)
        device_id, latitude, longitude, speed, heading, timestamp
       FROM tracking_data
       ORDER BY device_id, timestamp DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tracking/history?device_id=xxx&from=...&to=...
router.get('/history', requireAuth, async (req, res) => {
  const { device_id, from, to, limit = 500 } = req.query;
  const params = [];
  const conditions = [];

  if (device_id) { params.push(device_id); conditions.push(`device_id = $${params.length}`); }
  if (from) { params.push(from); conditions.push(`timestamp >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`timestamp <= $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  params.push(parseInt(limit));

  try {
    const { rows } = await db.query(
      `SELECT device_id, latitude, longitude, speed, heading, timestamp
       FROM tracking_data ${where}
       ORDER BY timestamp ASC
       LIMIT $${params.length}`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/tracking/devices — list known devices
router.get('/devices', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT device_id, COUNT(*) as data_points,
        MAX(timestamp) as last_seen
       FROM tracking_data
       GROUP BY device_id
       ORDER BY last_seen DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
