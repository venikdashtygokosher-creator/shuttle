const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/plans
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT p.*,
        COUNT(cp.id) FILTER (WHERE cp.status = 'active') as active_subscribers
       FROM plans p
       LEFT JOIN customer_plans cp ON cp.plan_id = p.id
       GROUP BY p.id
       ORDER BY p.created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/plans
router.post('/', requireAuth, async (req, res) => {
  const { name, type, total_cost, trip_limit, duration_months, manual_expiry_date } = req.body;
  if (!name || !type) {
    return res.status(400).json({ error: 'Name and type required' });
  }
  try {
    const { rows } = await db.query(
      `INSERT INTO plans (name, type, total_cost, trip_limit, duration_months, manual_expiry_date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [name, type, total_cost || 0, trip_limit || null, duration_months || null, manual_expiry_date || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/plans/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM plans WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Plan not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/plans/:id
router.put('/:id', requireAuth, async (req, res) => {
  const { name, type, total_cost, trip_limit, duration_months, manual_expiry_date, is_active } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE plans SET name=$1, type=$2, total_cost=$3, trip_limit=$4,
        duration_months=$5, manual_expiry_date=$6, is_active=$7
       WHERE id=$8 RETURNING *`,
      [name, type, total_cost, trip_limit || null, duration_months || null,
       manual_expiry_date || null, is_active !== undefined ? is_active : true, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Plan not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/plans/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    // Check for active subscribers
    const { rows } = await db.query(
      `SELECT COUNT(*) FROM customer_plans WHERE plan_id = $1 AND status = 'active'`,
      [req.params.id]
    );
    if (parseInt(rows[0].count) > 0) {
      return res.status(409).json({ error: 'Cannot delete plan with active subscribers' });
    }
    await db.query('DELETE FROM plans WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
