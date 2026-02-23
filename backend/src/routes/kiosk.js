const express = require('express');
const db = require('../db');
const stripe = require('stripe');

const router = express.Router();

// GET /api/kiosk/trips — active trips for kiosk dropdown
router.get('/trips', async (req, res) => {
  try {
    const now = new Date();
    const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS
    const dayOfWeek = now.getDay(); // 0=Sun

    const { rows } = await db.query(
      `SELECT * FROM trips
       WHERE is_active = true
       ORDER BY start_time`
    );

    // Tag which trips are currently running
    const enriched = rows.map((t) => {
      let isCurrentlyActive = false;
      if (t.type === 'daily') {
        isCurrentlyActive = currentTime >= t.start_time && currentTime <= t.end_time;
      } else if (t.type === 'weekly') {
        const days = t.days_of_week || [];
        isCurrentlyActive = days.includes(dayOfWeek) && currentTime >= t.start_time && currentTime <= t.end_time;
      } else if (t.type === 'single') {
        const today = now.toISOString().slice(0, 10);
        isCurrentlyActive = t.trip_date && t.trip_date.toISOString().slice(0, 10) === today
          && currentTime >= t.start_time && currentTime <= t.end_time;
      }
      return { ...t, is_currently_active: isCurrentlyActive };
    });

    res.json(enriched);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/kiosk/scan
router.post('/scan', async (req, res) => {
  const { user_id, trip_id } = req.body;
  if (!user_id || !trip_id) {
    return res.status(400).json({ error: 'user_id and trip_id required' });
  }

  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    // Look up customer
    const customerRes = await client.query(
      'SELECT * FROM customers WHERE id = $1',
      [user_id]
    );
    if (!customerRes.rows.length) {
      await client.query('ROLLBACK');
      await recordScan(client, trip_id, user_id, null, 'denied', null, 'Customer not found');
      await client.query('COMMIT');
      return res.json({
        status: 'denied',
        reason: 'Customer not found',
        customer: null,
      });
    }
    const customer = customerRes.rows[0];

    // Verify trip exists
    const tripRes = await client.query('SELECT * FROM trips WHERE id = $1', [trip_id]);
    if (!tripRes.rows.length) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Trip not found' });
    }

    // Get settings
    const settingsRes = await client.query(
      `SELECT value FROM settings WHERE key = 'renewal_reminder_days'`
    );
    const reminderDays = settingsRes.rows.length
      ? parseInt(JSON.parse(settingsRes.rows[0].value) || 3)
      : 3;

    // Get active plan
    const planRes = await client.query(
      `SELECT cp.*, p.name as plan_name, p.type as plan_type, p.total_cost, p.trip_limit
       FROM customer_plans cp
       LEFT JOIN plans p ON p.id = cp.plan_id
       WHERE cp.customer_id = $1 AND cp.status = 'active'
       ORDER BY cp.created_at DESC LIMIT 1`,
      [customer.id]
    );

    if (!planRes.rows.length) {
      await recordScan(client, trip_id, customer.id, null, 'denied', null, 'No active plan');
      await client.query('COMMIT');
      return res.json({
        status: 'denied',
        reason: 'No active plan',
        customer: { id: customer.id, name: customer.name },
      });
    }

    const cp = planRes.rows[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(cp.expiry_date);
    expiry.setHours(0, 0, 0, 0);

    // Check expiry
    if (expiry < today) {
      // Mark plan expired
      await client.query(
        `UPDATE customer_plans SET status='expired' WHERE id=$1`,
        [cp.id]
      );
      await recordScan(client, trip_id, customer.id, cp.id, 'denied', cp.trips_remaining, 'Plan expired');
      await client.query('COMMIT');
      return res.json({
        status: 'denied',
        reason: 'Plan expired',
        expiry_date: cp.expiry_date,
        customer: { id: customer.id, name: customer.name },
        plan: { name: cp.plan_name, type: cp.plan_type },
      });
    }

    const daysUntilExpiry = Math.floor((expiry - today) / (1000 * 60 * 60 * 24));
    const nearExpiry = daysUntilExpiry <= reminderDays;

    // Handle by plan type
    if (cp.plan_type === 'monthly' || cp.plan_type === 'bi-monthly') {
      if (cp.trip_limit === null) {
        // Unlimited
        await recordScan(client, trip_id, customer.id, cp.id, 'allowed', null, null);
        await client.query('COMMIT');
        return res.json({
          status: 'allowed',
          customer: { id: customer.id, name: customer.name },
          plan: { name: cp.plan_name, type: cp.plan_type },
          expiry_date: cp.expiry_date,
          days_until_expiry: daysUntilExpiry,
          near_expiry: nearExpiry,
          trips_remaining: null,
        });
      } else {
        // Trip-limited monthly
        if (cp.trips_remaining !== null && cp.trips_remaining <= 0) {
          await recordScan(client, trip_id, customer.id, cp.id, 'denied', 0, 'No trips remaining');
          await client.query('COMMIT');
          return res.json({
            status: 'denied',
            reason: 'No trips remaining',
            customer: { id: customer.id, name: customer.name },
            plan: { name: cp.plan_name, type: cp.plan_type },
          });
        }
        const newRemaining = cp.trips_remaining !== null ? cp.trips_remaining - 1 : null;
        await client.query(
          `UPDATE customer_plans SET trips_remaining=$1 WHERE id=$2`,
          [newRemaining, cp.id]
        );
        await recordScan(client, trip_id, customer.id, cp.id, 'allowed', newRemaining, null);
        await client.query('COMMIT');
        return res.json({
          status: 'allowed',
          customer: { id: customer.id, name: customer.name },
          plan: { name: cp.plan_name, type: cp.plan_type },
          expiry_date: cp.expiry_date,
          days_until_expiry: daysUntilExpiry,
          near_expiry: nearExpiry,
          trips_remaining: newRemaining,
        });
      }
    } else if (cp.plan_type === 'pay-as-you-go') {
      // Charge per trip via Stripe if card, record otherwise
      let chargeResult = null;
      if (customer.payment_method === 'card' && customer.stripe_customer_id) {
        try {
          const stripeClient = stripe(process.env.STRIPE_SECRET_KEY);
          const paymentIntent = await stripeClient.paymentIntents.create({
            amount: Math.round(cp.total_cost * 100),
            currency: 'usd',
            customer: customer.stripe_customer_id,
            confirm: true,
            off_session: true,
          });
          // Record payment
          await client.query(
            `INSERT INTO payments (customer_id, customer_plan_id, amount, method, stripe_payment_intent_id, status)
             VALUES ($1, $2, $3, 'card', $4, 'completed')`,
            [customer.id, cp.id, cp.total_cost, paymentIntent.id]
          );
          chargeResult = { charged: true, amount: cp.total_cost };
        } catch (stripeErr) {
          chargeResult = { charged: false, error: stripeErr.message };
        }
      } else {
        // Cash — just log
        await client.query(
          `INSERT INTO payments (customer_id, customer_plan_id, amount, method, status)
           VALUES ($1, $2, $3, 'cash', 'pending')`,
          [customer.id, cp.id, cp.total_cost]
        );
        chargeResult = { charged: false, cash: true, amount: cp.total_cost };
      }
      await recordScan(client, trip_id, customer.id, cp.id, 'allowed', null, null);
      await client.query('COMMIT');
      return res.json({
        status: 'allowed',
        customer: { id: customer.id, name: customer.name },
        plan: { name: cp.plan_name, type: cp.plan_type },
        charge: chargeResult,
        near_expiry: nearExpiry,
        days_until_expiry: daysUntilExpiry,
      });
    } else if (cp.plan_type === 'manual') {
      if (cp.trips_remaining !== null && cp.trips_remaining <= 0) {
        await recordScan(client, trip_id, customer.id, cp.id, 'denied', 0, 'No trips remaining');
        await client.query('COMMIT');
        return res.json({
          status: 'denied',
          reason: 'No trips remaining',
          customer: { id: customer.id, name: customer.name },
        });
      }
      const newRemaining = cp.trips_remaining !== null ? cp.trips_remaining - 1 : null;
      if (newRemaining !== null) {
        await client.query(
          `UPDATE customer_plans SET trips_remaining=$1 WHERE id=$2`,
          [newRemaining, cp.id]
        );
      }
      await recordScan(client, trip_id, customer.id, cp.id, 'allowed', newRemaining, null);
      await client.query('COMMIT');
      return res.json({
        status: 'allowed',
        customer: { id: customer.id, name: customer.name },
        plan: { name: cp.plan_name, type: cp.plan_type },
        expiry_date: cp.expiry_date,
        days_until_expiry: daysUntilExpiry,
        near_expiry: nearExpiry,
        trips_remaining: newRemaining,
      });
    }

    await client.query('ROLLBACK');
    return res.status(500).json({ error: 'Unknown plan type' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Kiosk scan error:', err);
    res.status(500).json({ error: 'Server error during scan' });
  } finally {
    client.release();
  }
});

async function recordScan(client, tripId, customerId, planId, status, tripsRemaining, reason) {
  await client.query(
    `INSERT INTO trip_scans (trip_id, customer_id, customer_plan_id, status, trips_remaining_after_scan, deny_reason)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tripId, customerId, planId, status, tripsRemaining, reason]
  );
}

module.exports = router;
