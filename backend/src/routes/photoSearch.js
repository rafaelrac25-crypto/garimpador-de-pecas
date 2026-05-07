/**
 * POST /api/photo-search
 *   multipart/form-data: campo 'photo' (até 10MB)
 *   query opcional: ?modelo=C10|C14
 *
 * Fluxo:
 *   1. Recebe foto, redimensiona pra ≤1024px com sharp
 *   2. Manda pra Groq vision identificar a peça
 *   3. Roda busca consolidada com as palavras-chave devolvidas pela IA
 *   4. Retorna { recognition, search } pro frontend
 */

const express = require('express');
const multer = require('multer');
const sharp = require('sharp');
const { recognize } = require('../services/partRecognition');
const { consolidate } = require('../services/consolidator');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },  /* 10MB */
});

router.post('/', upload.single('photo'), async (req, res) => {
  if (!req.file?.buffer) {
    return res.status(400).json({ error: 'campo "photo" obrigatório (multipart/form-data)' });
  }

  /* Redimensiona pra ≤1024px lado maior — economiza tokens da IA e banda */
  let resized;
  try {
    resized = await sharp(req.file.buffer)
      .rotate()
      .resize({ width: 1024, height: 1024, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
  } catch (e) {
    return res.status(400).json({ error: 'imagem inválida ou corrompida', detalhes: e.message });
  }

  let recognition;
  try {
    recognition = await recognize(resized, 'image/jpeg');
  } catch (err) {
    console.error('[photo-search] recognize falhou:', err.message);
    return res.status(502).json({ error: 'IA não conseguiu identificar a peça', detalhes: err.message });
  }

  /* Se IA não reconheceu peça, devolve só o reconhecimento sem busca */
  if (!recognition.palavras?.length || recognition.tipo === 'indefinido') {
    return res.json({
      recognition,
      search: null,
      hint: 'IA não identificou peça automotiva clara — tente outra foto ou busca por texto',
    });
  }

  /* Modelo: prioriza query param > o que IA marcou como compatível > C10 default */
  const modelo = req.query.modelo
              || (recognition.c10 ? 'C10' : recognition.c14 ? 'C14' : 'C10');

  const q = recognition.palavras.slice(0, 6).join(' ');  /* até 6 palavras-chave */

  let search = null;
  try {
    search = await consolidate({ q, modelo });
  } catch (e) {
    console.warn('[photo-search] busca consolidada falhou:', e.message);
  }

  return res.json({ recognition, search, modelo, q });
});

module.exports = router;
