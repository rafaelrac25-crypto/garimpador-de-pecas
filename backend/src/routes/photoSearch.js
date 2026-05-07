/* Busca por foto — recebe upload, manda pra IA vision identificar a peça,
   devolve palavras-chave que o frontend usa pra busca textual.
   Implementação completa na Fase 5. */

const express = require('express');
const router = express.Router();

router.post('/', async (req, res) => {
  return res.status(501).json({ error: 'photo-search ainda não implementada — Fase 5 do plano' });
});

module.exports = router;
