/**
 * Cron Vercel — rodam fora do middleware global de auth.
 *
 * Vercel injeta automaticamente Authorization: Bearer <CRON_SECRET> nos
 * crons configurados em vercel.json (quando a env CRON_SECRET existe).
 *
 * Job único: /api/cron/check-alerts
 *   Re-busca cada favorito que tem alerta, compara preço atual vs last_price,
 *   se cair >= threshold_pct, marca alerta como triggered (sem push web no MVP —
 *   Rafa vê os alertas ao abrir o app).
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { consolidate } = require('../services/consolidator');

function requireCronAuth(req, res, next) {
  const expected = (process.env.CRON_SECRET || '').trim();
  if (!expected) return next();  /* dev sem secret libera */
  const auth = (req.headers.authorization || '').trim();
  if (auth === `Bearer ${expected}`) return next();
  return res.status(401).json({ error: 'unauthorized' });
}

router.get('/ping', (req, res) => {
  res.json({ ok: true, at: new Date().toISOString(), has_cron_secret: !!process.env.CRON_SECRET });
});

router.get('/check-alerts', requireCronAuth, async (req, res) => {
  const startedAt = new Date().toISOString();
  let checked = 0;
  let triggered = 0;
  const events = [];

  try {
    const r = await db.query(`
      SELECT a.id AS alert_id, a.favorite_id, a.last_price, a.threshold_pct,
             f.title, f.url, f.source
      FROM alerts a
      JOIN favorites f ON f.id = a.favorite_id
    `);
    for (const row of r.rows) {
      checked++;
      try {
        const search = await consolidate({ q: row.title, limit: 10 });
        /* Procura match exato de URL ou título mais barato */
        const sameSource = search.results.find(it => it.url === row.url);
        const cheapest = search.results
          .filter(it => it.price && it.price > 0)
          .sort((a, b) => a.price - b.price)[0];
        const candidate = sameSource || cheapest;
        if (candidate?.price && row.last_price) {
          const dropPct = ((row.last_price - candidate.price) / row.last_price) * 100;
          if (dropPct >= row.threshold_pct) {
            triggered++;
            events.push({
              alert_id: row.alert_id,
              favorite_id: row.favorite_id,
              old_price: row.last_price,
              new_price: candidate.price,
              drop_pct: Math.round(dropPct),
              new_url: candidate.url,
            });
          }
          /* Atualiza last_price + last_checked_at */
          await db.query(
            'UPDATE alerts SET last_price = ?, last_checked_at = ? WHERE id = ?',
            [candidate.price, new Date().toISOString(), row.alert_id]
          );
        }
      } catch (e) {
        console.warn('[cron] alerta', row.alert_id, 'falhou:', e.message);
      }
    }
    return res.json({ ok: true, started_at: startedAt, checked, triggered, events });
  } catch (err) {
    console.error('[cron] erro fatal:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
