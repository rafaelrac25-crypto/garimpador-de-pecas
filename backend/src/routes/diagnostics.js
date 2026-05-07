/**
 * Aba Diagnósticos do sino — lista erros do sistema pra Rafa copiar e
 * mandar pro Claude resolver.
 *
 * GET    /api/diagnostics                → lista 100 erros mais recentes
 * GET    /api/diagnostics/open-count     → quantos erros sem resolução
 * PATCH  /api/diagnostics/:id/resolve    → marca como resolvido
 * DELETE /api/diagnostics/:id
 * DELETE /api/diagnostics/clear-resolved → limpa todos resolvidos
 */

const express = require('express');
const router = express.Router();
const db = require('../db');

router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const onlyOpen = req.query.onlyOpen === '1' || req.query.onlyOpen === 'true';
    const r = await db.query(
      onlyOpen
        ? 'SELECT * FROM error_logs WHERE resolved_at IS NULL ORDER BY created_at DESC LIMIT ?'
        : 'SELECT * FROM error_logs ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    const open = await db.query('SELECT COUNT(*) AS c FROM error_logs WHERE resolved_at IS NULL');
    return res.json({
      logs: r.rows,
      open_count: open.rows[0]?.c || 0,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.get('/open-count', async (req, res) => {
  try {
    const r = await db.query('SELECT COUNT(*) AS c FROM error_logs WHERE resolved_at IS NULL');
    return res.json({ open_count: r.rows[0]?.c || 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/resolve', async (req, res) => {
  try {
    await db.query(
      'UPDATE error_logs SET resolved_at = ? WHERE id = ?',
      [new Date().toISOString(), req.params.id]
    );
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM error_logs WHERE id = ?', [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/clear-resolved', async (req, res) => {
  try {
    const r = await db.query('DELETE FROM error_logs WHERE resolved_at IS NOT NULL');
    return res.json({ ok: true, removed: r.rowCount || 0 });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
