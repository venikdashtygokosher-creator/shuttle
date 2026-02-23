const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// GET /api/payments
router.get('/', requireAuth, async (req, res) => {
  const { customer_id, method, status, from, to, page = 1, limit = 50 } = req.query;
  const params = [];
  const conditions = [];

  if (customer_id) { params.push(customer_id); conditions.push(`p.customer_id = $${params.length}`); }
  if (method) { params.push(method); conditions.push(`p.method = $${params.length}`); }
  if (status) { params.push(status); conditions.push(`p.status = $${params.length}`); }
  if (from) { params.push(from); conditions.push(`DATE(p.created_at) >= $${params.length}`); }
  if (to) { params.push(to); conditions.push(`DATE(p.created_at) <= $${params.length}`); }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const offset = (page - 1) * limit;

  try {
    const countRes = await db.query(`SELECT COUNT(*) FROM payments p ${where}`, params);
    const total = parseInt(countRes.rows[0].count);

    params.push(limit, offset);
    const { rows } = await db.query(
      `SELECT p.*, c.name as customer_name
       FROM payments p
       LEFT JOIN customers c ON c.id = p.customer_id
       ${where}
       ORDER BY p.created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
    res.json({ payments: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/payments — manual cash payment entry
router.post('/', requireAuth, async (req, res) => {
  const { customer_id, customer_plan_id, amount, method, notes } = req.body;
  if (!customer_id || !amount) {
    return res.status(400).json({ error: 'customer_id and amount required' });
  }
  try {
    const { rows } = await db.query(
      `INSERT INTO payments (customer_id, customer_plan_id, amount, method, status, notes)
       VALUES ($1, $2, $3, $4, 'completed', $5) RETURNING *`,
      [customer_id, customer_plan_id || null, amount, method || 'cash', notes || null]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/payments/:id/refund
router.post('/:id/refund', requireAuth, async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM payments WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Payment not found' });
    const payment = rows[0];

    if (payment.method === 'card' && payment.stripe_payment_intent_id) {
      const Stripe = require('stripe');
      const stripeClient = Stripe(process.env.STRIPE_SECRET_KEY);
      await stripeClient.refunds.create({ payment_intent: payment.stripe_payment_intent_id });
    }

    await db.query(`UPDATE payments SET status='refunded' WHERE id=$1`, [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Refund failed: ' + err.message });
  }
});

// POST /api/stripe/webhook
router.post('/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const Stripe = require('stripe');
  const stripeClient = Stripe(process.env.STRIPE_SECRET_KEY);

  let event;
  try {
    event = stripeClient.webhooks.constructEvent(
      req.body, sig, process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  if (event.type === 'payment_intent.succeeded') {
    const pi = event.data.object;
    await db.query(
      `UPDATE payments SET status='completed' WHERE stripe_payment_intent_id=$1`,
      [pi.id]
    );
  } else if (event.type === 'payment_intent.payment_failed') {
    const pi = event.data.object;
    await db.query(
      `UPDATE payments SET status='failed' WHERE stripe_payment_intent_id=$1`,
      [pi.id]
    );
  }

  res.json({ received: true });
});

// POST /api/payments/create-intent — Stripe payment intent for frontend
router.post('/create-intent', requireAuth, async (req, res) => {
  const { amount, customer_id } = req.body;
  if (!amount) return res.status(400).json({ error: 'Amount required' });
  try {
    const Stripe = require('stripe');
    const stripeClient = Stripe(process.env.STRIPE_SECRET_KEY);

    let stripeCustomerId;
    if (customer_id) {
      const { rows } = await db.query('SELECT stripe_customer_id FROM customers WHERE id=$1', [customer_id]);
      if (rows.length && rows[0].stripe_customer_id) {
        stripeCustomerId = rows[0].stripe_customer_id;
      }
    }

    const params = {
      amount: Math.round(amount * 100),
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
    };
    if (stripeCustomerId) params.customer = stripeCustomerId;

    const paymentIntent = await stripeClient.paymentIntents.create(params);
    res.json({ client_secret: paymentIntent.client_secret, payment_intent_id: paymentIntent.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
