/**
 * POST /api/search
 *   body: { q, modelo, filtros: { precoMin, precoMax, condicao, estado }, limit }
 *   resposta: { results, sources, counts, q, modelo }
 *
 * Busca consolidada em ML + OLX + Web Motor. Persiste a busca no histórico.
 */

const express = require('express');
const router = express.Router();
const { consolidate } = require('../services/consolidator');
const db = require('../db');

router.post('/', async (req, res) => {
  const { q, modelo, filtros, limit } = req.body || {};
  if (!q || typeof q !== 'string' || q.trim().length === 0) {
    return res.status(400).json({ error: 'campo q (texto da busca) obrigatório' });
  }

  try {
    const consolidated = await consolidate({ q: q.trim(), modelo, filtros, limit });

    /* Persiste histórico em background — não bloqueia resposta */
    db.query(
      'INSERT INTO searches (q, modelo, filtros, results_count) VALUES (?, ?, ?, ?)',
      [q.trim(), modelo || null, JSON.stringify(filtros || {}), consolidated.results.length]
    ).catch(err => console.warn('[search] falha ao salvar histórico:', err.message));

    return res.json({
      q: q.trim(),
      modelo: modelo || null,
      filtros: filtros || {},
      ...consolidated,
    });
  } catch (err) {
    console.error('[search] erro:', err);
    return res.status(500).json({ error: 'busca falhou', detalhes: err.message });
  }
});

/* GET /api/search/history — histórico recente */
router.get('/history', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
    const r = await db.query(
      'SELECT id, q, modelo, filtros, results_count, created_at FROM searches ORDER BY created_at DESC LIMIT ?',
      [limit]
    );
    return res.json({ history: r.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

router.delete('/history/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM searches WHERE id = ?', [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
