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

module.exports = router;
