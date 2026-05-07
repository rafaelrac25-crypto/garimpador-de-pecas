/* /api/ml/* — autoriza Mercado Livre (com auth do app, só Rafa).
   /api/ml-callback é em arquivo separado pra não exigir token (ML chama). */

const express = require('express');
const mlAuth = require('../services/mlAuth');

const router = express.Router();

router.get('/start', (req, res) => {
  if (!mlAuth.isConfigured()) {
    return res.status(503).json({
      error: 'ML não configurado',
      missing: ['ML_CLIENT_ID', 'ML_CLIENT_SECRET', 'ML_REDIRECT_URI'].filter(k => !process.env[k]),
    });
  }
  /* state opcional pra CSRF — token fixo do app já protege start */
  const url = mlAuth.getAuthorizeUrl();
  res.redirect(302, url);
});

router.get('/status', async (_req, res) => {
  try {
    const s = await mlAuth.status();
    res.json(s);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/disconnect', async (_req, res) => {
  try {
    const db = require('../db');
    await db.query('DELETE FROM ml_tokens WHERE id = ?', [1]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
