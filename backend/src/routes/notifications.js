/**
 * Notificações in-app — sino do header.
 *
 * GET    /api/notifications              → lista (50 mais recentes)
 * GET    /api/notifications/unread-count → só o número
 * PATCH  /api/notifications/:id/read     → marca como lida
 * PATCH  /api/notifications/read-all     → marca todas
 * DELETE /api/notifications/:id
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const r = await db.query(
      'SELECT * FROM notifications ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    const unread = await db.query(
      'SELECT COUNT(*) AS c FROM notifications WHERE read_at IS NULL'
    );
    return res.json({
      notifications: r.rows,
      unread_count: unread.rows[0]?.c || 0,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/unread-count', async (req, res) => {
  try {
    const r = await db.query('SELECT COUNT(*) AS c FROM notifications WHERE read_at IS NULL');
    return res.json({ unread_count: r.rows[0]?.c || 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/read', async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET read_at = ? WHERE id = ?',
      [new Date().toISOString(), req.params.id]
    );
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/read-all', async (req, res) => {
  try {
    await db.query(
      'UPDATE notifications SET read_at = ? WHERE read_at IS NULL',
      [new Date().toISOString()]
    );
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM notifications WHERE id = ?', [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
