/**
 * CRUD de peças favoritas.
 *
 * POST   /api/favorites            { source, externalId, title, price, url, thumbUrl, metadata }
 * GET    /api/favorites
 * DELETE /api/favorites/:id
 * POST   /api/favorites/:id/alert  { thresholdPct }   — cria alerta de queda de preço
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM favorites ORDER BY created_at DESC LIMIT 200');
    return res.json({ favorites: r.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  const { source, externalId, title, price, url, thumbUrl, metadata } = req.body || {};
  if (!source || !externalId || !title || !url) {
    return res.status(400).json({ error: 'source, externalId, title e url obrigatórios' });
  }
  try {
    /* INSERT idempotente — UNIQUE (source, external_id) protege duplicidade */
    await db.query(
      `INSERT OR IGNORE INTO favorites (source, external_id, title, price, url, thumb_url, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [source, String(externalId), title, price || null, url, thumbUrl || null, metadata ? JSON.stringify(metadata) : null]
    );
    const r = await db.query(
      'SELECT * FROM favorites WHERE source = ? AND external_id = ?',
      [source, String(externalId)]
    );
    return res.status(201).json({ favorite: r.rows[0] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const r = await db.query('DELETE FROM favorites WHERE id = ?', [req.params.id]);
    return res.json({ ok: true, removed: r.rowCount || 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.post('/:id/alert', async (req, res) => {
  const thresholdPct = Math.max(1, Math.min(100, parseInt(req.body?.thresholdPct, 10) || 10));
  try {
    /* Pega preço atual do favorito pra usar como baseline */
    const fav = await db.query('SELECT * FROM favorites WHERE id = ?', [req.params.id]);
    if (!fav.rows[0]) return res.status(404).json({ error: 'favorito não encontrado' });
    await db.query(
      `INSERT INTO alerts (favorite_id, last_price, threshold_pct, last_checked_at)
       VALUES (?, ?, ?, ?)`,
      [req.params.id, fav.rows[0].price, thresholdPct, new Date().toISOString()]
    );
    return res.status(201).json({ ok: true, alert_for: req.params.id, thresholdPct });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/alert', async (req, res) => {
  try {
    const r = await db.query('DELETE FROM alerts WHERE favorite_id = ?', [req.params.id]);
    return res.json({ ok: true, removed: r.rowCount || 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
