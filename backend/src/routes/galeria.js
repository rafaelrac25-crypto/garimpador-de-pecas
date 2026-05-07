/**
 * Galeria de fotos — fonte: Instagram do @c14docosta.
 *
 * Dois modos automáticos:
 *
 * 1. **Oficial** (se IG_ACCESS_TOKEN definido):
 *    Busca via Instagram Graph API (Business/Creator account → Page do FB).
 *    Rafa precisa: converter @c14docosta em Business no app IG → conectar a
 *    uma Page do Facebook → pegar long-lived token (60 dias, refresh auto)
 *    em developers.facebook.com (mesmo App pode reusar do AdManager se
 *    autorizar).
 *    Endpoint Graph: GET /me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp
 *
 * 2. **Estático** (fallback sem token):
 *    Lê de data/galeria-static.json — Rafa adiciona URLs manualmente.
 *    Bom pro MVP enquanto o token oficial não é configurado.
 *
 * GET /api/galeria
 *   ?limit=24
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const router = express.Router();

const STATIC_FILE = path.join(__dirname, '..', 'data', 'galeria-static.json');
const IG_GRAPH = 'https://graph.facebook.com/v20.0/me/media';
const TIMEOUT = 8000;
const CACHE_TTL_MS = 60 * 60 * 1000;  /* 1h */

let cache = null;
let cacheAt = 0;

router.get('/', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 24, 100);

  /* Cache 1h pra não bater na API IG a cada refresh */
  if (cache && (Date.now() - cacheAt) < CACHE_TTL_MS) {
    return res.json({ ...cache, cached: true, ageMs: Date.now() - cacheAt });
  }

  /* Modo oficial */
  if (process.env.IG_ACCESS_TOKEN) {
    try {
      const resp = await axios.get(IG_GRAPH, {
        params: {
          fields: 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp',
          limit,
          access_token: process.env.IG_ACCESS_TOKEN,
        },
        timeout: TIMEOUT,
      });
      const items = (resp.data?.data || []).map(p => ({
        id: p.id,
        caption: p.caption || '',
        type: p.media_type,        /* IMAGE / VIDEO / CAROUSEL_ALBUM */
        url: p.media_type === 'VIDEO' ? (p.thumbnail_url || p.media_url) : p.media_url,
        videoUrl: p.media_type === 'VIDEO' ? p.media_url : null,
        permalink: p.permalink,
        timestamp: p.timestamp,
      }));
      const payload = { source: 'instagram_graph', items, count: items.length };
      cache = payload;
      cacheAt = Date.now();
      return res.json(payload);
    } catch (err) {
      console.warn('[galeria] Graph API falhou, caindo pro estático:', err.response?.data || err.message);
      /* Continua pro fallback abaixo */
    }
  }

  /* Modo estático */
  try {
    if (!fs.existsSync(STATIC_FILE)) {
      return res.json({
        source: 'static',
        items: [],
        note: 'Galeria vazia. Configure IG_ACCESS_TOKEN ou popule backend/src/data/galeria-static.json',
      });
    }
    const raw = JSON.parse(fs.readFileSync(STATIC_FILE, 'utf-8'));
    const items = (Array.isArray(raw) ? raw : raw.items || []).slice(0, limit);
    const payload = { source: 'static', items, count: items.length };
    cache = payload;
    cacheAt = Date.now();
    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/* DELETE /api/galeria/cache — força refresh imediato (Rafa postou foto nova) */
router.delete('/cache', (req, res) => {
  cache = null;
  cacheAt = 0;
  res.json({ ok: true, cleared: true });
});

module.exports = router;
