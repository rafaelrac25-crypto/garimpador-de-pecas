/* Busca consolidada — agrega múltiplas fontes (ML, OLX, Web Motor)
   e devolve resultado normalizado. Implementação inicial só com ML;
   OLX e Web Motor entram nas Fases 3 e 4. */

const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  const { q, modelo, filtros } = req.body || {};
  if (!q || typeof q !== 'string') {
    return res.status(400).json({ error: 'campo q (texto da busca) obrigatório' });
  }

  /* TODO Fase 2: chamar services/mercadoLivre.js
     TODO Fase 3: chamar services/olx.js
     TODO Fase 4: chamar services/webmotors.js
     TODO: services/consolidator.js dedup + ordena */
  return res.json({
    q,
    modelo: modelo || 'C10',
    filtros: filtros || {},
    results: [],
    sources: { mercadoLivre: 'pending', olx: 'pending', webmotors: 'pending' },
    note: 'busca ainda não implementada — Fases 2-4 do plano',
  });
});

module.exports = router;
