// routes/notifications.js — Push subscription management
const express = require('express');
const pool = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

// GET /api/notifications/vapid-key — return the public VAPID key
router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

// POST /api/notifications/subscribe — save a push subscription for the logged-in user
router.post('/subscribe', authRequired, async (req, res) => {
  try {
    const { endpoint, keys } = req.body || {};

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ error: 'Invalid subscription object' });
    }

    // Upsert: insert or update if endpoint already exists for this user
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE p256dh = VALUES(p256dh), auth = VALUES(auth)`,
      [req.user.id, endpoint, keys.p256dh, keys.auth]
    );

    console.log(`🔔 Push subscription saved for user ${req.user.id}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('Save push subscription error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/notifications/subscribe — remove a push subscription
router.delete('/subscribe', authRequired, async (req, res) => {
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) {
      return res.status(400).json({ error: 'Endpoint required' });
    }

    await pool.query(
      'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
      [req.user.id, endpoint]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('Delete push subscription error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
