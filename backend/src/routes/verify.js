/**
 * Verificação de match de resultados via IA vision.
 *
 * POST /api/verify/results
 *   body: { userQuery, modelo, results: [{ url, thumbUrl, title, source, externalId }] }
 *   resposta: { results: [...input, verification: {match, confianca, peca_real, compatibilidade, obs}] }
 *
 * Pra cada resultado com thumbUrl, baixa a thumb, redimensiona, manda pra IA
 * com a query do user pra confirmar se a peça da foto bate com o pedido.
 *
 * Cache em memória por (thumbUrl + userQuery) — não reanalisar a mesma combinação.
 *
 * Caso de uso: anúncios na ML/OLX com foto mas título genérico ("peça antiga",
 * "lote misturado", "lanterna ford?"). A IA olha a foto e confirma se é C10/C14
 * mesmo, com nível de confiança.
 */

const express = require('express');
const router = express.Router();
const axios = require('axios');
const sharp = require('sharp');
const { verifyMatch } = require('../services/partRecognition');

const VERIFY_CACHE = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;  /* 24h — verificação não muda */
const MAX_PARALLEL = 3;  /* concorrência: não sobrecarrega API */

/* Limita quantos resultados verificar por request — economiza quota da IA */
const MAX_VERIFY_PER_REQ = 12;

router.post('/results', async (req, res) => {
  const { userQuery, modelo, results } = req.body || {};
  if (!userQuery || typeof userQuery !== 'string') {
    return res.status(400).json({ error: 'userQuery obrigatório' });
  }
  if (!Array.isArray(results) || results.length === 0) {
    return res.status(400).json({ error: 'results array obrigatório' });
  }

  /* Filtra os com thumb e ainda não verificados (cache hit retorna direto) */
  const toVerify = results.slice(0, MAX_VERIFY_PER_REQ);
  const verified = await runInBatches(toVerify, MAX_PARALLEL, async (item) => {
    if (!item.thumbUrl) {
      return { ...item, verification: null };
    }
    const cacheKey = item.thumbUrl + '|' + userQuery + '|' + (modelo || '');
    const cached = VERIFY_CACHE.get(cacheKey);
    if (cached && (Date.now() - cached.at) < CACHE_TTL_MS) {
      return { ...item, verification: { ...cached.value, cached: true } };
    }
    try {
      const buf = await fetchAndResize(item.thumbUrl);
      const verification = await verifyMatch({
        image: buf,
        mime: 'image/jpeg',
        userQuery,
        modelo,
      });
      VERIFY_CACHE.set(cacheKey, { value: verification, at: Date.now() });
      return { ...item, verification };
    } catch (err) {
      console.warn('[verify]', item.url, '→', err.message);
      return { ...item, verification: { error: err.message } };
    }
  });

  return res.json({
    userQuery,
    modelo: modelo || null,
    results: verified,
    not_verified_count: results.length - toVerify.length,
  });
});

/* Helper: download + resize pra ≤768px (suficiente pra verificação rápida).
   UA realista pra evitar bloqueio em CDNs (Wikipedia, alguns scraper-blockers).
   Verifica content-type — se vier HTML (página de bloqueio), erra cedo. */
async function fetchAndResize(url) {
  const resp = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 10000,
    maxContentLength: 8 * 1024 * 1024,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
      'Accept-Language': 'pt-BR,pt;q=0.9,en;q=0.8',
    },
  });
  const ct = (resp.headers['content-type'] || '').toLowerCase();
  if (!ct.startsWith('image/')) {
    throw new Error(`URL não retornou imagem (content-type: ${ct || 'desconhecido'})`);
  }
  return await sharp(Buffer.from(resp.data))
    .rotate()
    .resize({ width: 768, height: 768, fit: 'inside', withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .toBuffer();
}

/* Roda promises com concorrência controlada (sem libs externas) */
async function runInBatches(items, concurrency, worker) {
  const out = new Array(items.length);
  let cursor = 0;
  async function next() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await worker(items[i]);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => next());
  await Promise.all(workers);
  return out;
}

module.exports = router;
