const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/customers
router.get('/', requireAuth, async (req, res) => {
  const { search, payment_method, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;
  const params = [];
  const conditions = [];

  if (search) {
    params.push(`%${search}%`);
    conditions.push(`(c.name ILIKE $${params.length} OR c.phone ILIKE $${params.length} OR CAST(c.id AS TEXT) ILIKE $${params.length})`);
  }
  if (payment_method) {
    params.push(payment_method);
    conditions.push(`c.payment_method = $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const countResult = await db.query(
      `SELECT COUNT(*) FROM customers c ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    params.push(limit, offset);
    const { rows } = await db.query(
      `SELECT c.*,
        cp.status as plan_status, cp.expiry_date, cp.trips_remaining,
        p.name as plan_name, p.type as plan_type
       FROM customers c
       LEFT JOIN customer_plans cp ON cp.customer_id = c.id AND cp.status = 'active'
       LEFT JOIN plans p ON p.id = cp.plan_id
       ${where}
       ORDER BY c.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ customers: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/customers
router.post('/', requireAuth, async (req, res) => {
  const { name, phone, address, email, payment_method } = req.body;
  if (!name || !phone || !address || !payment_method) {
    return res.status(400).json({ error: 'Name, phone, address, and payment_method required' });
  }
  try {
    const { rows } = await db.query(
      `INSERT INTO customers (name, phone, address, email, payment_method)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, phone, address, email || null, payment_method]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/customers/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT c.*,
        cp.id as customer_plan_id, cp.status as plan_status,
        cp.start_date, cp.expiry_date, cp.trips_remaining, cp.payment_method as sub_payment_method,
        p.name as plan_name, p.type as plan_type, p.total_cost, p.trip_limit
       FROM customers c
       LEFT JOIN customer_plans cp ON cp.customer_id = c.id AND cp.status = 'active'
       LEFT JOIN plans p ON p.id = cp.plan_id
       WHERE c.id = $1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/customers/:id
router.put('/:id', requireAuth, async (req, res) => {
  const { name, phone, address, email, payment_method } = req.body;
  try {
    const { rows } = await db.query(
      `UPDATE customers SET name=$1, phone=$2, address=$3, email=$4, payment_method=$5, updated_at=NOW()
       WHERE id=$6 RETURNING *`,
      [name, phone, address, email || null, payment_method, req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Customer not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/customers/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rowCount } = await db.query('DELETE FROM customers WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Customer not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/customers/:id/scans
router.get('/:id/scans', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT ts.*, t.name as trip_name, t.type as trip_type
       FROM trip_scans ts
       LEFT JOIN trips t ON t.id = ts.trip_id
       WHERE ts.customer_id = $1
       ORDER BY ts.scanned_at DESC
       LIMIT 100`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/customers/:id/payments
router.get('/:id/payments', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT p.*, cp_alias.start_date, cp_alias.expiry_date
       FROM payments p
       LEFT JOIN customer_plans cp_alias ON cp_alias.id = p.customer_plan_id
       WHERE p.customer_id = $1
       ORDER BY p.created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/customers/:id/plans
router.get('/:id/plans', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT cp.*, p.name as plan_name, p.type as plan_type, p.total_cost, p.trip_limit
       FROM customer_plans cp
       LEFT JOIN plans p ON p.id = cp.plan_id
       WHERE cp.customer_id = $1
       ORDER BY cp.created_at DESC`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/customers/:id/subscribe
router.post('/:id/subscribe', requireAuth, async (req, res) => {
  const { plan_id, payment_method, stripe_payment_id, start_date } = req.body;
  if (!plan_id || !payment_method) {
    return res.status(400).json({ error: 'plan_id and payment_method required' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Cancel any current active plan
    await client.query(
      `UPDATE customer_plans SET status='cancelled' WHERE customer_id=$1 AND status='active'`,
      [req.params.id]
    );

    // Get plan details
    const planRes = await client.query('SELECT * FROM plans WHERE id = $1', [plan_id]);
    if (!planRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Plan not found' });
    }
    const plan = planRes.rows[0];

    // Calculate expiry
    const sd = start_date ? new Date(start_date) : new Date();
    let expiryDate;
    if (plan.type === 'monthly') {
      expiryDate = new Date(sd);
      expiryDate.setMonth(expiryDate.getMonth() + (plan.duration_months || 1));
    } else if (plan.type === 'bi-monthly') {
      expiryDate = new Date(sd);
      expiryDate.setMonth(expiryDate.getMonth() + 2);
    } else if (plan.type === 'pay-as-you-go') {
      // No fixed expiry, set far future
      expiryDate = new Date('2099-12-31');
    } else if (plan.type === 'manual') {
      expiryDate = plan.manual_expiry_date ? new Date(plan.manual_expiry_date) : new Date('2099-12-31');
    }

    const { rows } = await client.query(
      `INSERT INTO customer_plans (customer_id, plan_id, start_date, expiry_date, trips_remaining, payment_method, stripe_payment_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        req.params.id, plan_id,
        sd.toISOString().slice(0, 10),
        expiryDate.toISOString().slice(0, 10),
        plan.trip_limit,
        payment_method,
        stripe_payment_id || null,
      ]
    );

    // Record payment
    if (plan.total_cost > 0) {
      await client.query(
        `INSERT INTO payments (customer_id, customer_plan_id, amount, method, stripe_payment_intent_id, status)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.params.id, rows[0].id, plan.total_cost, payment_method, stripe_payment_id || null, 'completed']
      );
    }

    await client.query('COMMIT');
    res.status(201).json(rows[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  } finally {
    client.release();
  }
});

module.exports = router;
