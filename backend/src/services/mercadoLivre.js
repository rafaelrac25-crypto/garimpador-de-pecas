/**
 * Busca Mercado Livre lendo cache populado por scraper Playwright em
 * GitHub Actions (cron 2h + dispatch manual via /api/admin/scrape-ml/trigger).
 *
 * Por que não scraping live:
 *   ML bloqueia datacenter Vercel + Cloudflare Worker (suspicious-traffic).
 *   ScraperAPI free não cobre ML (Protected Domain → premium pago).
 *   Caminho free + sustentável: Playwright em runner GitHub (IP residencial-ish)
 *   popula tabela ml_offers_cache; backend lê daqui.
 *
 * Filtragem:
 *   - Match LIKE no título com tokens da query (todos precisam aparecer)
 *   - Filtro de preço (precoMin/precoMax) aplicado em SQL
 *   - Ordena por scraped_at DESC (mais recente primeiro)
 */

const db = require('../db');

async function search({ q, modelo, filtros = {}, limit = 30 } = {}) {
  if (!q) throw new Error('q obrigatório');

  const fullQ = modelo && !q.toLowerCase().includes(modelo.toLowerCase())
    ? `${q} ${modelo}`
    : q;

  /* Quebra a query em tokens — cada token vira um LIKE %token%.
     Tokens curtos (<3) são descartados pra não viciar match (ex: "c" em "c10"). */
  const tokens = fullQ
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3);

  if (tokens.length === 0) {
    return { source: 'mercadolivre', results: [], note: 'query muito curta' };
  }

  /* Monta WHERE: LOWER(title) LIKE %t1% AND LOWER(title) LIKE %t2% ... */
  const conditions = tokens.map((_, i) => `LOWER(title) LIKE ?`).join(' AND ');
  const params = tokens.map((t) => `%${t}%`);

  let priceClause = '';
  if (filtros.precoMin) {
    priceClause += ' AND price >= ?';
    params.push(Number(filtros.precoMin));
  }
  if (filtros.precoMax) {
    priceClause += ' AND price <= ?';
    params.push(Number(filtros.precoMax));
  }

  params.push(Number(limit) || 30);

  let result;
  try {
    result = await db.query(
      `SELECT external_id, termo, modelo, title, price, url, thumb_url, free_shipping, scraped_at
         FROM ml_offers_cache
        WHERE ${conditions}${priceClause}
        ORDER BY scraped_at DESC
        LIMIT ?`,
      params
    );
  } catch (err) {
    console.warn('[mercadoLivre] query cache falhou:', err.message);
    return {
      source: 'mercadolivre',
      results: [],
      error: err.message,
      note: 'cache indisponível — rode o scraper em /api/admin/scrape-ml/trigger',
    };
  }

  const results = (result?.rows || []).map((r) => ({
    source: 'mercadolivre',
    externalId: r.external_id,
    title: r.title,
    price: r.price ? Number(r.price) : null,
    currency: 'BRL',
    url: r.url,
    thumbUrl: r.thumb_url,
    location: null,
    raw: {
      freeShipping: !!r.free_shipping,
      scrapedAt: r.scraped_at,
      termo: r.termo,
    },
  }));

  return {
    source: 'mercadolivre',
    results,
    note: results.length === 0
      ? 'cache vazio pra esta busca — rode o scraper ou aguarde próximo cron (2h)'
      : null,
  };
}

module.exports = { search };
