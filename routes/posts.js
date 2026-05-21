// routes/posts.js
const express = require('express');
const pool = require('../db');
const { authRequired, requirePublisher } = require('../middleware/auth');

const router = express.Router();

// GET /api/posts
// Fetches chronological feed. Viewers only see college_wide + subscribed channels.
// Admins see everything. Publishers see college_wide + their assigned channels.
router.get('/', authRequired, async (req, res) => {
  try {
    const me = req.user;
    let sql;
    let params = [];

    if (me.role === 'admin') {
      sql = `
        SELECT p.id, p.title, p.body, p.level, p.type, p.attachment_url, p.is_pinned, p.created_at,
               u.full_name AS publisher_name,
               c.name AS channel_name, c.type AS channel_type
        FROM posts p
        JOIN users u ON p.publisher_id = u.id
        LEFT JOIN channels c ON p.channel_id = c.id
        WHERE p.is_published = TRUE
        ORDER BY p.is_pinned DESC, p.created_at DESC
        LIMIT 100
      `;
    } else {
      // Publisher or Viewer
      sql = `
        SELECT p.id, p.title, p.body, p.level, p.type, p.attachment_url, p.is_pinned, p.created_at,
               u.full_name AS publisher_name,
               c.name AS channel_name, c.type AS channel_type
        FROM posts p
        JOIN users u ON p.publisher_id = u.id
        LEFT JOIN channels c ON p.channel_id = c.id
        WHERE p.is_published = TRUE
          AND (
            p.level = 'college_wide' OR
            p.channel_id IN (SELECT channel_id FROM subscriptions WHERE subscriber_id = ? AND status = 'approved')
          )
        ORDER BY p.is_pinned DESC, p.created_at DESC
        LIMIT 100
      `;
      params = [me.id];
    }

    const [rows] = await pool.query(sql, params);
    res.json({ posts: rows });
  } catch (err) {
    console.error('List posts error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/posts
// Publishers and Admins only.
router.post('/', authRequired, requirePublisher, async (req, res) => {
  try {
    const { title, body, level, type, channel_id, is_pinned } = req.body || {};
    
    if (!title || !body || !level || !type) {
      return res.status(400).json({ error: 'Title, body, level, and type are required' });
    }

    // Authorization checks
    if (req.user.role === 'publisher') {
      if (level === 'college_wide') {
        return res.status(403).json({ error: 'Publishers cannot create college_wide broadcasts' });
      }
      
      // Ensure the publisher actually has rights to this channel
      const [chanRows] = await pool.query('SELECT department_id, club_id FROM channels WHERE id = ?', [channel_id]);
      if (chanRows.length === 0) return res.status(404).json({ error: 'Channel not found' });
      
      const chan = chanRows[0];
      const isDeptMatch = chan.department_id !== null && chan.department_id === req.user.department_id;
      const isClubMatch = chan.club_id !== null && req.user.managed_club_ids.includes(chan.club_id);
      
      if (!isDeptMatch && !isClubMatch) {
        return res.status(403).json({ error: 'You are not authorized to post to this channel' });
      }
    }

    const [result] = await pool.query(
      `INSERT INTO posts (publisher_id, channel_id, title, body, level, type, is_pinned)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, channel_id || null, title, body, level, type, is_pinned || false]
    );

    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/posts/:id
router.delete('/:id', authRequired, requirePublisher, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [rows] = await pool.query('SELECT publisher_id FROM posts WHERE id = ?', [id]);
    if (!rows.length) return res.status(404).json({ error: 'Post not found' });
    
    if (req.user.role !== 'admin' && rows[0].publisher_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Only the original author or admin can delete this' });
    }
    
    await pool.query('DELETE FROM posts WHERE id = ?', [id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
