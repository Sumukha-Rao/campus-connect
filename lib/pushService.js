// lib/pushService.js — Web Push notification broadcaster
const webpush = require('web-push');
const pool = require('../db');

// Configure VAPID credentials
webpush.setVapidDetails(
  process.env.VAPID_EMAIL || 'mailto:admin@rvce.edu.in',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

/**
 * Send a push notification to ALL subscribed devices
 * @param {object} post - The newly created post { id, title, body, publisher_name }
 */
async function notifyAll(post) {
  try {
    const [subscriptions] = await pool.query('SELECT * FROM push_subscriptions');

    if (!subscriptions.length) {
      console.log('📭 No push subscriptions found — skipping notifications');
      return;
    }

    const payload = JSON.stringify({
      title: post.title || 'New Post on RVCE Connect',
      body: (post.body || '').substring(0, 120) + ((post.body || '').length > 120 ? '…' : ''),
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: `post-${post.id}`,
      data: {
        url: `/app.html?post=${post.id}`,
        postId: post.id
      }
    });

    console.log(`🔔 Sending push to ${subscriptions.length} device(s)...`);

    const results = await Promise.allSettled(
      subscriptions.map(sub => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };
        return webpush.sendNotification(pushSubscription, payload);
      })
    );

    // Clean up expired/invalid subscriptions
    const staleIds = [];
    results.forEach((result, i) => {
      if (result.status === 'rejected') {
        const statusCode = result.reason?.statusCode;
        // 404 or 410 means the subscription is no longer valid
        if (statusCode === 404 || statusCode === 410) {
          staleIds.push(subscriptions[i].id);
        }
        console.warn(`Push failed for sub ${subscriptions[i].id}:`, result.reason?.message || result.reason);
      }
    });

    if (staleIds.length > 0) {
      await pool.query('DELETE FROM push_subscriptions WHERE id IN (?)', [staleIds]);
      console.log(`🧹 Cleaned up ${staleIds.length} stale subscription(s)`);
    }

    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    console.log(`✅ Push sent successfully to ${succeeded}/${subscriptions.length} device(s)`);
  } catch (err) {
    console.error('Push notification error:', err);
  }
}

module.exports = { notifyAll };
