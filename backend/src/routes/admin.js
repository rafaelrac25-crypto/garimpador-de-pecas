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
