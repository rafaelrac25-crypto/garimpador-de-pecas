/* CRUD de peças favoritas. Implementação Fase 6. */

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => res.json({ favorites: [] }));
router.post('/', (req, res) => res.status(501).json({ error: 'favorites ainda não implementado — Fase 6' }));
router.delete('/:id', (req, res) => res.status(501).json({ error: 'favorites ainda não implementado — Fase 6' }));

module.exports = router;
