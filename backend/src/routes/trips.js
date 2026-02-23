const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/trips
router.get('/', requireAuth, async (req, res) => {
  const { active } = req.query;
  try {
    let query = `
      SELECT t.*,
        COUNT(ts.id) as total_scans_today
      FROM trips t
      LEFT JOIN trip_scans ts ON ts.trip_id = t.id
        AND DATE(ts.scanned_at) = CURRENT_DATE
    `;
    const params = [];
    if (active === 'true') {
      query += ` WHERE t.is_active = true`;
    }
    query += ` GROUP BY t.id ORDER BY t.created_at DESC`;
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/trips
router.post('/', requireAuth, async (req, res) => {
  const { name, type, start_time, end_time, days_of_week, trip_date } = req.body;
  if (!name || !type || !start_time || !end_time) {
    return res.status(400).json({ error: 'Name, type, start_time, and end_time required' });
  }
  try {
    const { rows } = await db.query(
      `INSERT INTO trips (name, type, start_time, end_time, days_of_week, trip_date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, type, start_time, end_time, days_of_week || null, trip_date || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/trips/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM trips WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Trip not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/trips/:id
router.put('/:id', requireAuth, async (req, res) => {
  const { name, type, start_time, end_time, days_of_week, trip_date, is_active } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE trips SET name=$1, type=$2, start_time=$3, end_time=$4,
        days_of_week=$5, trip_date=$6, is_active=$7
       WHERE id=$8 RETURNING *`,
      [name, type, start_time, end_time, days_of_week || null, trip_date || null,
       is_active !== undefined ? is_active : true, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Trip not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/trips/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await db.query('DELETE FROM trips WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/trips/:id/scans — recent scans for a trip
router.get('/:id/scans', requireAuth, async (req, res) => {
  const { date, limit = 100 } = req.query;
  try {
    let query = `
      SELECT ts.*, c.name as customer_name, c.phone as customer_phone
      FROM trip_scans ts
      LEFT JOIN customers c ON c.id = ts.customer_id
      WHERE ts.trip_id = $1
    `;
    const params = [req.params.id];
    if (date) {
      params.push(date);
      query += ` AND DATE(ts.scanned_at) = $${params.length}`;
    }
    params.push(limit);
    query += ` ORDER BY ts.scanned_at DESC LIMIT $${params.length}`;
    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
