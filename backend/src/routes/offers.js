/**
 * Ofertas em destaque pra home.
 *
 * GET /api/offers/featured?modelo=C10
 *   Roda buscas dos termos quentes do dataset (kit motor, para-choque, etc.)
 *   filtrando por preço baixo + tem foto + tem preço definido.
 *   Ordena por "atratividade" (score): tem foto + preço baixo + frete grátis.
 *
 * Cache em memória 30min — evita martelar fontes a cada refresh do front.
 */

const express = require('express');
const router = express.Router();
const { consolidate } = require('../services/consolidator');

/* Termos quentes pré-curados — alinhados ao dataset c10-c14-pecas.js do front */
const TERMOS_QUENTES = [
  { q: 'kit motor C10',        peso: 1.0 },
  { q: 'para-choque C10',      peso: 0.8 },
  { q: 'caçamba C14',          peso: 0.8 },
  { q: 'farol C10',            peso: 0.7 },
  { q: 'painel C10',           peso: 0.7 },
  { q: 'embreagem C10',        peso: 0.7 },
];

const CACHE_TTL_MS = 30 * 60 * 1000;
let cache = null;
let cacheAt = 0;

router.get('/featured', async (req, res) => {
  const modelo = (req.query.modelo || 'C10').toUpperCase();
  const cacheKey = modelo;

  if (cache && cache.modelo === cacheKey && (Date.now() - cacheAt) < CACHE_TTL_MS) {
    return res.json({ ...cache.payload, cached: true, ageMs: Date.now() - cacheAt });
  }

  try {
    /* Roda 3 termos em paralelo (não os 6 — economia de quota das fontes) */
    const top3 = TERMOS_QUENTES.slice(0, 3);
    const buscas = await Promise.allSettled(
      top3.map(t => consolidate({ q: t.q, modelo, limit: 10 }))
    );

    /* Junta resultados, computa score de "oferta" */
    const all = [];
    buscas.forEach((b, i) => {
      if (b.status === 'fulfilled' && Array.isArray(b.value.results)) {
        const peso = top3[i].peso;
        b.value.results.forEach(r => {
          all.push({ ...r, _termoOrigem: top3[i].q, _peso: peso });
        });
      }
    });

    /* Score de oferta:
       - Item tem foto (+0.3)
       - Item tem preço (+0.2)
       - Preço em quartil inferior do conjunto (+0.4 escalado)
       - Frete grátis (+0.1) */
    const comPreco = all.filter(r => r.price && r.price > 0);
    const precos = comPreco.map(r => r.price).sort((a, b) => a - b);
    const q1 = precos[Math.floor(precos.length * 0.25)] || 0;
    const median = precos[Math.floor(precos.length * 0.5)] || 0;

    const ranked = all.map(r => {
      let score = 0;
      if (r.thumbUrl) score += 0.3;
      if (r.price && r.price > 0) {
        score += 0.2;
        if (r.price <= q1) score += 0.4;
        else if (r.price <= median) score += 0.2;
      }
      if (r.raw?.shipping) score += 0.1;
      score *= r._peso || 1;
      return { ...r, _ofertaScore: score };
    }).sort((a, b) => b._ofertaScore - a._ofertaScore);

    /* Top 12, mas dedup forte por título pra não repetir mesma peça em fontes diferentes */
    const seen = new Set();
    const featured = [];
    for (const r of ranked) {
      const key = (r.title || '').toLowerCase().slice(0, 50);
      if (seen.has(key)) continue;
      seen.add(key);
      featured.push(r);
      if (featured.length >= 12) break;
    }

    const payload = {
      modelo,
      featured,
      counts: {
        termosBuscados: top3.length,
        candidatos: all.length,
        retornados: featured.length,
      },
      median_price: median,
      q1_price: q1,
      generated_at: new Date().toISOString(),
    };

    cache = { modelo: cacheKey, payload };
    cacheAt = Date.now();

    return res.json(payload);
  } catch (err) {
    console.error('[offers] erro:', err);
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
