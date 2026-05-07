/* Proxy IA Groq — endpoint genérico pra chat e vision.
   Stub agora, implementação real na Fase 5. */

const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  if (!process.env.GROQ_API_KEY) {
    return res.status(503).json({ error: 'GROQ_API_KEY não configurada' });
  }
  return res.status(501).json({ error: 'proxy IA ainda não implementado — Fase 5' });
});

module.exports = router;
