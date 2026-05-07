/**
 * Cron Vercel — rodam fora do middleware global de auth.
 *
 * Vercel injeta automaticamente Authorization: Bearer <CRON_SECRET> nos
 * crons configurados em vercel.json (quando CRON_SECRET existe).
 *
 * Job principal: /api/cron/check-alerts
 *   Processa TODOS os price_alerts ativos. Pra cada um:
 *     1. Roda busca consolidada com q + filtros
 *     2. Acha menor preço de item com URL válida
 *     3. Se ≤ threshold_price → emite notificação (in-app + email/wa se configurado)
 *     4. Atualiza last_checked_at + last_match_*
 *   Processa também alerts antigos (ligados a favoritos) por compatibilidade.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { consolidate } = require('../services/consolidator');
const notifications = require('../services/notifications');

function requireCronAuth(req, res, next) {
  const expected = (process.env.CRON_SECRET || '').trim();
  if (!expected) return next();
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
    /* ===== price_alerts (novos — tipo Zoom) ===== */
    const palerts = await db.query(`
      SELECT id, q, modelo, filtros, threshold_price, baseline_price,
             email_to, whatsapp_to, last_match_price
      FROM price_alerts
      WHERE active = 1
    `);

    for (const a of palerts.rows) {
      checked++;
      try {
        const filtros = a.filtros ? JSON.parse(a.filtros) : {};
        const c = await consolidate({ q: a.q, modelo: a.modelo, filtros, limit: 30 });
        const candidates = c.results
          .filter(it => Number.isFinite(it.price) && it.price > 0 && it.url)
          .sort((x, y) => x.price - y.price);

        const cheapest = candidates[0];
        const matched = cheapest && cheapest.price <= a.threshold_price;

        if (matched) {
          /* Evita repetir notif do MESMO preço já notificado */
          const repeat = a.last_match_price && Math.abs(a.last_match_price - cheapest.price) < 0.01;
          if (!repeat) {
            triggered++;
            const baselineDrop = a.baseline_price
              ? Math.round(((a.baseline_price - cheapest.price) / a.baseline_price) * 100)
              : null;
            await notifications.emit({
              kind: 'price_alert',
              title: `🔔 Achei "${a.q}" por R$${cheapest.price.toLocaleString('pt-BR')}!`,
              message: [
                `Limite que você definiu: R$${a.threshold_price.toLocaleString('pt-BR')}`,
                a.baseline_price ? `Preço base do mercado: R$${a.baseline_price.toLocaleString('pt-BR')}${baselineDrop ? ` (-${baselineDrop}%)` : ''}` : null,
                `Fonte: ${cheapest.source}`,
                cheapest.title,
              ].filter(Boolean).join('\n'),
              link: cheapest.url,
              metadata: { alert_id: a.id, source: cheapest.source, externalId: cheapest.externalId },
              email_to: a.email_to,
              whatsapp_to: a.whatsapp_to,
            });
            events.push({
              alert_id: a.id,
              q: a.q,
              threshold: a.threshold_price,
              found_price: cheapest.price,
              source: cheapest.source,
              url: cheapest.url,
            });
          }
        }

        await db.query(
          `UPDATE price_alerts
              SET last_checked_at = ?,
                  last_match_price = ?,
                  last_match_at = ?
            WHERE id = ?`,
          [new Date().toISOString(),
           matched ? cheapest.price : a.last_match_price,
           matched ? new Date().toISOString() : null,
           a.id]
        );
      } catch (e) {
        console.warn('[cron] price_alert', a.id, 'falhou:', e.message);
      }
    }

    /* ===== alerts antigos (ligados a favoritos — compatibilidade) ===== */
    const oldAlerts = await db.query(`
      SELECT a.id AS alert_id, a.favorite_id, a.last_price, a.threshold_pct,
             f.title, f.url, f.source
      FROM alerts a
      JOIN favorites f ON f.id = a.favorite_id
    `);
    for (const row of oldAlerts.rows) {
      checked++;
      try {
        const search = await consolidate({ q: row.title, limit: 10 });
        const cheapest = search.results
          .filter(it => it.price && it.price > 0)
          .sort((x, y) => x.price - y.price)[0];
        if (cheapest?.price && row.last_price) {
          const dropPct = ((row.last_price - cheapest.price) / row.last_price) * 100;
          if (dropPct >= row.threshold_pct) {
            triggered++;
            await notifications.emit({
              kind: 'price_alert',
              title: `🔔 "${row.title}" caiu ${Math.round(dropPct)}%`,
              message: `Era R$${row.last_price.toLocaleString('pt-BR')}, agora R$${cheapest.price.toLocaleString('pt-BR')}`,
              link: cheapest.url,
              metadata: { favorite_id: row.favorite_id, alert_id: row.alert_id },
            });
          }
          await db.query(
            'UPDATE alerts SET last_price = ?, last_checked_at = ? WHERE id = ?',
            [cheapest.price, new Date().toISOString(), row.alert_id]
          );
        }
      } catch (e) {
        console.warn('[cron] favorite alert', row.alert_id, 'falhou:', e.message);
      }
    }

    return res.json({ ok: true, started_at: startedAt, checked, triggered, events });
  } catch (err) {
    console.error('[cron] erro fatal:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
