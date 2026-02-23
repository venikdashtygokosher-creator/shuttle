const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/settings
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT key, value FROM settings ORDER BY key');
    const settings = {};
    rows.forEach((r) => {
      settings[r.key] = JSON.parse(r.value);
    });
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/settings — update one or more settings
router.put('/', requireAuth, async (req, res) => {
  const updates = req.body; // { key: value, ... }
  if (!updates || typeof updates !== 'object') {
    return res.status(400).json({ error: 'Object of key:value pairs required' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    for (const [key, value] of Object.entries(updates)) {
      await client.query(
        `INSERT INTO settings (key, value, updated_at)
         VALUES ($1, $2::jsonb, NOW())
         ON CONFLICT (key) DO UPDATE SET value = $2::jsonb, updated_at = NOW()`,
        [key, JSON.stringify(value)]
      );
    }
    await client.query('COMMIT');

    const { rows } = await db.query('SELECT key, value FROM settings ORDER BY key');
    const settings = {};
    rows.forEach((r) => { settings[r.key] = JSON.parse(r.value); });
    res.json(settings);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
