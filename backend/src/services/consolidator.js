/**
 * Consolida resultados de múltiplas fontes (ML, OLX, Web Motor).
 *
 * Regras:
 * - Roda buscas em paralelo (Promise.allSettled — uma fonte falhar não derruba as outras).
 * - Dedup heurístico por similaridade de título + preço próximo (±5%).
 * - Ordenação: por relevância (preferência: tem foto > tem preço > título mais curto).
 * - Adiciona campo `relevancia` (0..1) baseado em match de palavras-chave da query.
 */

const ML  = require('./mercadoLivre');
const OLX = require('./olx');
const WM  = require('./webmotors');

/**
 * @param {Object} args  passado pra cada source.search()
 * @returns {{ results, sources, totalDeduped }}
 */
async function consolidate(args) {
  const sources = [
    { name: 'mercadolivre', fn: ML.search },
    { name: 'olx',          fn: OLX.search },
    { name: 'webmotors',    fn: WM.search },
  ];

  const settled = await Promise.allSettled(sources.map(s => s.fn(args)));

  const sourceStatus = {};
  let allResults = [];
  settled.forEach((r, i) => {
    const name = sources[i].name;
    if (r.status === 'fulfilled') {
      sourceStatus[name] = {
        ok: !r.value.error,
        count: r.value.results?.length || 0,
        error: r.value.error || null,
        note: r.value.note || null,
      };
      if (Array.isArray(r.value.results)) {
        allResults = allResults.concat(r.value.results);
      }
    } else {
      sourceStatus[name] = { ok: false, count: 0, error: String(r.reason).slice(0, 200) };
    }
  });

  const beforeDedup = allResults.length;
  const deduped = dedupResults(allResults);
  const ranked = rankByRelevance(deduped, args.q || '');

  return {
    results: ranked,
    sources: sourceStatus,
    counts: { fetched: beforeDedup, afterDedup: deduped.length, returned: ranked.length },
  };
}

/** Dedup por similaridade de título + preço dentro de 5% */
function dedupResults(items) {
  const out = [];
  for (const item of items) {
    const dup = out.find(o => isSameItem(o, item));
    if (!dup) out.push(item);
  }
  return out;
}

function isSameItem(a, b) {
  if (a.source === b.source && a.externalId === b.externalId) return true;
  const t1 = normalizeTitle(a.title);
  const t2 = normalizeTitle(b.title);
  if (!t1 || !t2) return false;
  if (t1 === t2) return true;
  /* Similaridade simples: 80% de tokens em comum E preços próximos */
  const tokens1 = new Set(t1.split(' ').filter(t => t.length > 2));
  const tokens2 = new Set(t2.split(' ').filter(t => t.length > 2));
  if (tokens1.size === 0 || tokens2.size === 0) return false;
  const inter = [...tokens1].filter(t => tokens2.has(t)).length;
  const overlap = inter / Math.min(tokens1.size, tokens2.size);
  if (overlap < 0.8) return false;
  if (a.price && b.price) {
    const diff = Math.abs(a.price - b.price) / Math.max(a.price, b.price);
    if (diff > 0.05) return false;
  }
  return true;
}

function normalizeTitle(t) {
  return String(t || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Ordena por relevância: peças com foto + preço definido + match de query vêm primeiro */
function rankByRelevance(items, query) {
  const qTokens = normalizeTitle(query).split(' ').filter(Boolean);
  return items
    .map(it => ({ ...it, relevancia: scoreItem(it, qTokens) }))
    .sort((a, b) => b.relevancia - a.relevancia);
}

function scoreItem(item, qTokens) {
  let score = 0;
  if (item.thumbUrl) score += 0.25;
  if (item.price && item.price > 0) score += 0.20;
  if (item.location) score += 0.05;
  /* Match de tokens da query no título */
  if (qTokens.length > 0 && item.title) {
    const titleTokens = new Set(normalizeTitle(item.title).split(' '));
    const hits = qTokens.filter(t => titleTokens.has(t)).length;
    score += 0.50 * (hits / qTokens.length);
  }
  return Math.min(1, score);
}

module.exports = { consolidate };
