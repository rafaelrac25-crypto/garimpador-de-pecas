/**
 * Alertas de preço — estilo Zoom.
 *
 * GET  /api/alerts/baseline?q=&modelo=          → preço base atual + sugestão
 * GET  /api/alerts                              → lista alertas
 * POST /api/alerts                              → cria alerta
 * PATCH /api/alerts/:id                         → ativa/desativa, edita threshold
 * DELETE /api/alerts/:id
 *
 * GET  /api/notifications                       → in-app (sino)
 * PATCH /api/notifications/:id/read
 * DELETE /api/notifications/:id
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { consolidate } = require('../services/consolidator');

/* GET /api/alerts/baseline — calcula preço atual + sugestão de threshold */
router.get('/baseline', async (req, res) => {
  const q = (req.query.q || '').toString().trim();
  const modelo = req.query.modelo;
  if (!q) return res.status(400).json({ error: 'q obrigatório' });

  try {
    const consolidated = await consolidate({ q, modelo, limit: 30 });
    const precos = consolidated.results
      .map(r => r.price)
      .filter(p => Number.isFinite(p) && p > 0)
      .sort((a, b) => a - b);

    if (precos.length === 0) {
      return res.json({
        q, modelo,
        sample_size: 0,
        confidence: 'none',
        note: 'Nenhuma peça com preço definido encontrada. Tente termos mais amplos.',
      });
    }

    const min = precos[0];
    const max = precos[precos.length - 1];
    const median = precos[Math.floor(precos.length / 2)];
    const avg = precos.reduce((s, p) => s + p, 0) / precos.length;
    const q1 = precos[Math.floor(precos.length * 0.25)];

    /* Sugestão: 20% abaixo da mediana (negociação típica em peça usada) */
    const suggestedThreshold = Math.round(median * 0.80);

    /* Confiança: amostras + dispersão */
    const confidence = precos.length >= 10 ? 'high'
                     : precos.length >= 5  ? 'medium'
                     : 'low';

    return res.json({
      q, modelo,
      sample_size: precos.length,
      min, max, median, avg, q1,
      suggested_threshold: suggestedThreshold,
      confidence,
      note: confidence === 'low'
        ? 'Poucas amostras — preço sugerido pode oscilar.'
        : null,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* GET /api/alerts — lista todos */
router.get('/', async (req, res) => {
  try {
    const r = await db.query(`
      SELECT id, q, modelo, filtros, threshold_price, baseline_price, baseline_sample,
             email_to, whatsapp_to, active, last_checked_at, last_match_price,
             last_match_at, created_at
      FROM price_alerts ORDER BY created_at DESC
    `);
    return res.json({ alerts: r.rows });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* POST /api/alerts — cria */
router.post('/', async (req, res) => {
  const { q, modelo, filtros, threshold_price, email_to, whatsapp_to } = req.body || {};
  if (!q || typeof q !== 'string') return res.status(400).json({ error: 'q obrigatório' });
  if (!Number.isFinite(threshold_price) || threshold_price <= 0) {
    return res.status(400).json({ error: 'threshold_price (number > 0) obrigatório' });
  }

  /* Calcula baseline imediato pra registro */
  let baseline_price = null;
  let baseline_sample = 0;
  try {
    const c = await consolidate({ q, modelo, filtros, limit: 30 });
    const precos = c.results.map(r => r.price).filter(p => p > 0).sort((a, b) => a - b);
    if (precos.length > 0) {
      baseline_price = precos[Math.floor(precos.length / 2)];
      baseline_sample = precos.length;
    }
  } catch (e) {
    console.warn('[alerts] baseline inicial falhou (continuando sem):', e.message);
  }

  try {
    const r = await db.query(
      `INSERT INTO price_alerts (q, modelo, filtros, threshold_price, baseline_price,
                                 baseline_sample, email_to, whatsapp_to, active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [q, modelo || null, JSON.stringify(filtros || {}), threshold_price,
       baseline_price, baseline_sample, email_to || null, whatsapp_to || null]
    );
    return res.status(201).json({
      ok: true,
      id: r.lastInsertRowid,
      baseline_price,
      baseline_sample,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* PATCH /api/alerts/:id — atualiza campos editáveis */
router.patch('/:id', async (req, res) => {
  const fields = [];
  const params = [];
  for (const k of ['threshold_price', 'active', 'email_to', 'whatsapp_to']) {
    if (req.body[k] !== undefined) {
      fields.push(`${k} = ?`);
      params.push(req.body[k]);
    }
  }
  if (fields.length === 0) return res.status(400).json({ error: 'nenhum campo pra atualizar' });
  params.push(req.params.id);
  try {
    await db.query(`UPDATE price_alerts SET ${fields.join(', ')} WHERE id = ?`, params);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* DELETE /api/alerts/:id */
router.delete('/:id', async (req, res) => {
  try {
    await db.query('DELETE FROM price_alerts WHERE id = ?', [req.params.id]);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
