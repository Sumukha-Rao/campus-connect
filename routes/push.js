// routes/push.js — Web Push (VAPID) subscription endpoints + fan-out helper
const express = require('express');
const webpush = require('web-push');
const pool = require('../db');
const { authRequired } = require('../middleware/auth');

const router = express.Router();

const PUBLIC = process.env.VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@rvce.edu.in';
const pushEnabled = Boolean(PUBLIC && PRIVATE);

if (pushEnabled) {
  webpush.setVapidDetails(SUBJECT, PUBLIC, PRIVATE);
  console.log('✔ Web Push enabled (VAPID configured)');
} else {
  console.warn('⚠ Web Push disabled: set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in .env');
}

// GET /api/push/vapid-public-key — client needs this to subscribe
router.get('/vapid-public-key', (req, res) => {
  res.json({ key: pushEnabled ? PUBLIC : null });
});

// POST /api/push/subscribe — store this browser's push endpoint for the user
router.post('/subscribe', authRequired, async (req, res) => {
  try {
    const sub = req.body && req.body.subscription;
    if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
      return res.status(400).json({ error: 'Invalid subscription' });
    }
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
      [req.user.id, sub.endpoint, sub.keys.p256dh, sub.keys.auth]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('Push subscribe error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/push/subscribe — remove a browser endpoint (e.g. on logout)
router.delete('/subscribe', authRequired, async (req, res) => {
  try {
    const endpoint = req.body && req.body.endpoint;
    if (endpoint) {
      await pool.query('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?', [endpoint, req.user.id]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Fan out a push to every bell-enabled subscriber of a channel (excluding the author).
// Safe to call without awaiting — it swallows its own errors.
async function notifyChannelSubscribers(channelId, payload, excludeUserId) {
  if (!pushEnabled || !channelId) return;
  try {
    const [subs] = await pool.query(
      `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
         FROM subscriptions s
         JOIN push_subscriptions ps ON ps.user_id = s.subscriber_id
        WHERE s.channel_id = ?
          AND s.push_notifications_enabled = TRUE
          AND s.subscriber_id <> ?`,
      [channelId, excludeUserId || 0]
    );
    const data = JSON.stringify(payload);
    await Promise.all(subs.map(async row => {
      const subscription = { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } };
      try {
        await webpush.sendNotification(subscription, data);
      } catch (err) {
        // Endpoint gone — drop it so we don't keep retrying.
        if (err.statusCode === 404 || err.statusCode === 410) {
          await pool.query('DELETE FROM push_subscriptions WHERE id = ?', [row.id]).catch(() => {});
        } else {
          console.error('Push send error:', err.statusCode || err.message);
        }
      }
    }));
  } catch (err) {
    console.error('notifyChannelSubscribers failed:', err.message);
  }
}

module.exports = router;
module.exports.notifyChannelSubscribers = notifyChannelSubscribers;
