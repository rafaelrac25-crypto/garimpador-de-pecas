/* /api/admin/* — operações de manutenção (rodar schema, listar tabelas).
   Sem auth de usuário (mesma porta do health). Em prod uso pessoal único. */

const express = require('express');
const router = express.Router();

router.post('/init-schema', async (_req, res) => {
  try {
    const init = require('../db/init');
    const result = await init();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0, 5) });
  }
});

router.get('/ml-debug', async (_req, res) => {
  try {
    const mlAuth = require('../services/mlAuth');
    const axios = require('axios');
    const proxyFetch = require('../services/proxyFetch');
    const token = await mlAuth.getAccessToken();
    const tokens = await mlAuth.loadTokens();
    const result = { hasToken: !!token, tokenPrefix: token?.slice(0, 30) + '...', userId: tokens?.user_id };

    /* Tenta busca direta sem proxy */
    try {
      const r = await axios.get('https://api.mercadolibre.com/sites/MLB/search?q=carburador&limit=1', {
        headers: { 'Authorization': `Bearer ${token}` },
        timeout: 10000,
      });
      result.directSearch = { status: r.status, hasResults: !!r.data?.results, count: r.data?.results?.length };
    } catch (e) {
      result.directSearch = { status: e.response?.status, error: e.response?.data || e.message };
    }

    /* Tenta busca via proxy CF */
    try {
      const r = await proxyFetch.get('https://api.mercadolibre.com/sites/MLB/search', {
        params: { q: 'carburador', limit: 1 },
        headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/json' },
        timeout: 10000,
      });
      const body = typeof r.data === 'string' ? r.data.slice(0, 300) : JSON.stringify(r.data).slice(0, 300);
      result.proxySearch = { status: r.status, body };
    } catch (e) {
      result.proxySearch = { status: e.response?.status, error: e.response?.data || e.message };
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0, 5) });
  }
});

router.get('/tables', async (_req, res) => {
  try {
    const db = require('../db');
    const isPg = !!process.env.DATABASE_URL;
    const sql = isPg
      ? "SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY table_name"
      : "SELECT name AS table_name FROM sqlite_master WHERE type='table' ORDER BY name";
    const r = await db.query(sql);
    res.json({ dialect: isPg ? 'postgres' : 'sqlite', tables: r.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* GET /api/admin/scrape-ml/status — leitura do status da última run do scraper */
router.get('/scrape-ml/status', async (_req, res) => {
  try {
    const db = require('../db');
    const r = await db.query('SELECT * FROM ml_scrape_status WHERE id = 1', []);
    const status = r.rows?.[0] || null;
    const c = await db.query('SELECT COUNT(*) AS c FROM ml_offers_cache', []);
    const cacheCount = Number(c.rows?.[0]?.c || 0);
    res.json({ status, cache_count: cacheCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* POST /api/admin/scrape-ml/trigger — dispara workflow ML-Scraper no GitHub
   Requer GITHUB_PAT (token com scope `workflow`) setado no Vercel. */
router.post('/scrape-ml/trigger', async (_req, res) => {
  const pat = process.env.GITHUB_PAT;
  if (!pat) {
    return res.status(503).json({
      error: 'GITHUB_PAT não configurado. Cria PAT em github.com/settings/tokens com scope `workflow` e seta no Vercel.',
    });
  }
  const owner = process.env.GITHUB_OWNER || 'rafaelrac25-crypto';
  const repo  = process.env.GITHUB_REPO  || 'garimpador-de-pecas';
  const workflowFile = 'ml-scraper.yml';
  const url = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowFile}/dispatches`;

  try {
    const axios = require('axios');
    const r = await axios.post(url, { ref: 'main' }, {
      headers: {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${pat}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      timeout: 10000,
    });
    res.json({ ok: true, status: r.status, message: 'Workflow disparado. Resultado em ~30-60s.' });
  } catch (err) {
    const ghMsg = err.response?.data?.message || err.message;
    res.status(err.response?.status || 500).json({ error: ghMsg });
  }
});

module.exports = router;
