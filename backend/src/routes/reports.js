const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/reports/summary — dashboard summary
router.get('/summary', requireAuth, async (req, res) => {
  try {
    const [activeCustomers, revenue, popularPlans, busyTrips, expiringPlans] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM customer_plans WHERE status='active'`),
      db.query(`
        SELECT
          SUM(CASE WHEN method='cash' AND status='completed' THEN amount ELSE 0 END) as cash_revenue,
          SUM(CASE WHEN method='card' AND status='completed' THEN amount ELSE 0 END) as card_revenue,
          SUM(CASE WHEN status='completed' THEN amount ELSE 0 END) as total_revenue
        FROM payments
        WHERE DATE(created_at) >= DATE_TRUNC('month', CURRENT_DATE)
      `),
      db.query(`
        SELECT p.name, p.type, COUNT(cp.id) as subscriber_count
        FROM customer_plans cp
        JOIN plans p ON p.id = cp.plan_id
        WHERE cp.status = 'active'
        GROUP BY p.id, p.name, p.type
        ORDER BY subscriber_count DESC
        LIMIT 5
      `),
      db.query(`
        SELECT t.name, t.type, COUNT(ts.id) as scan_count
        FROM trip_scans ts
        JOIN trips t ON t.id = ts.trip_id
        WHERE DATE(ts.scanned_at) >= CURRENT_DATE - INTERVAL '30 days'
        GROUP BY t.id, t.name, t.type
        ORDER BY scan_count DESC
        LIMIT 5
      `),
      db.query(`
        SELECT cp.*, c.name as customer_name, c.phone as customer_phone, p.name as plan_name
        FROM customer_plans cp
        JOIN customers c ON c.id = cp.customer_id
        JOIN plans p ON p.id = cp.plan_id
        WHERE cp.status = 'active'
          AND cp.expiry_date <= CURRENT_DATE + INTERVAL '7 days'
          AND cp.expiry_date >= CURRENT_DATE
        ORDER BY cp.expiry_date ASC
        LIMIT 20
      `),
    ]);

    res.json({
      active_customers: parseInt(activeCustomers.rows[0].count),
      revenue: revenue.rows[0],
      popular_plans: popularPlans.rows,
      busy_trips: busyTrips.rows,
      expiring_plans: expiringPlans.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reports/trips/:trip_id — ridership over time for a trip
router.get('/trips/:trip_id', requireAuth, async (req, res) => {
  const { from, to, group_by = 'day' } = req.query;
  const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const toDate = to || new Date().toISOString().slice(0, 10);

  let dateTrunc;
  if (group_by === 'week') dateTrunc = 'week';
  else if (group_by === 'month') dateTrunc = 'month';
  else dateTrunc = 'day';

  try {
    const { rows } = await db.query(
      `SELECT
        DATE_TRUNC($1, ts.scanned_at) as period,
        COUNT(*) as total_scans,
        COUNT(CASE WHEN ts.status = 'allowed' THEN 1 END) as allowed,
        COUNT(CASE WHEN ts.status = 'denied' THEN 1 END) as denied
       FROM trip_scans ts
       WHERE ts.trip_id = $2
         AND DATE(ts.scanned_at) BETWEEN $3 AND $4
       GROUP BY period
       ORDER BY period ASC`,
      [dateTrunc, req.params.trip_id, fromDate, toDate]
    );

    const tripRes = await db.query('SELECT * FROM trips WHERE id=$1', [req.params.trip_id]);
    res.json({
      trip: tripRes.rows[0] || null,
      data: rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reports/customers/:customer_id — full history for a customer
router.get('/customers/:customer_id', requireAuth, async (req, res) => {
  const { from, to } = req.query;
  const fromDate = from || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const toDate = to || new Date().toISOString().slice(0, 10);

  try {
    const [customerRes, scans, payments, plans] = await Promise.all([
      db.query('SELECT * FROM customers WHERE id=$1', [req.params.customer_id]),
      db.query(
        `SELECT ts.*, t.name as trip_name
         FROM trip_scans ts
         LEFT JOIN trips t ON t.id = ts.trip_id
         WHERE ts.customer_id=$1 AND DATE(ts.scanned_at) BETWEEN $2 AND $3
         ORDER BY ts.scanned_at DESC`,
        [req.params.customer_id, fromDate, toDate]
      ),
      db.query(
        `SELECT * FROM payments WHERE customer_id=$1 ORDER BY created_at DESC`,
        [req.params.customer_id]
      ),
      db.query(
        `SELECT cp.*, p.name as plan_name, p.type as plan_type, p.total_cost
         FROM customer_plans cp
         LEFT JOIN plans p ON p.id = cp.plan_id
         WHERE cp.customer_id=$1 ORDER BY cp.created_at DESC`,
        [req.params.customer_id]
      ),
    ]);

    if (!customerRes.rows.length) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({
      customer: customerRes.rows[0],
      scans: scans.rows,
      payments: payments.rows,
      plans: plans.rows,
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reports/export/trips/:trip_id?format=csv
router.get('/export/trips/:trip_id', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT ts.scanned_at, c.name as customer_name, c.phone, ts.status,
         ts.trips_remaining_after_scan, ts.deny_reason, t.name as trip_name
       FROM trip_scans ts
       LEFT JOIN customers c ON c.id = ts.customer_id
       LEFT JOIN trips t ON t.id = ts.trip_id
       WHERE ts.trip_id=$1
       ORDER BY ts.scanned_at DESC`,
      [req.params.trip_id]
    );

    const headers = ['Date/Time', 'Customer', 'Phone', 'Status', 'Trips Remaining', 'Deny Reason', 'Trip'];
    const csv = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.scanned_at?.toISOString() || '',
          `"${r.customer_name || ''}"`,
          r.phone || '',
          r.status,
          r.trips_remaining_after_scan ?? '',
          `"${r.deny_reason || ''}"`,
          `"${r.trip_name || ''}"`,
        ].join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=trip-${req.params.trip_id}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/reports/export/customers/:customer_id?format=csv
router.get('/export/customers/:customer_id', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT ts.scanned_at, t.name as trip_name, ts.status, ts.trips_remaining_after_scan
       FROM trip_scans ts
       LEFT JOIN trips t ON t.id = ts.trip_id
       WHERE ts.customer_id=$1
       ORDER BY ts.scanned_at DESC`,
      [req.params.customer_id]
    );

    const headers = ['Date/Time', 'Trip', 'Status', 'Trips Remaining After'];
    const csv = [
      headers.join(','),
      ...rows.map((r) =>
        [
          r.scanned_at?.toISOString() || '',
          `"${r.trip_name || ''}"`,
          r.status,
          r.trips_remaining_after_scan ?? '',
        ].join(',')
      ),
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=customer-${req.params.customer_id}.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
