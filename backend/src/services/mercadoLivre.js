/**
 * Scraping da listagem pública do Mercado Livre.
 *
 * Por que NÃO usamos a API oficial:
 *   ML mudou política em 2024 — /sites/MLB/search retorna 403 mesmo com
 *   OAuth user válido (testado). Restou-nos a página HTML pública.
 *
 * URL: https://lista.mercadolivre.com.br/<termo-com-hifens>
 *
 * Exige ScraperAPI (SCRAPERAPI_KEY) — Cloudflare Worker é detectado pelo
 * anti-bot do ML como "suspicious-traffic". ScraperAPI usa IP residencial
 * brasileiro e passa. Fallback: Worker CF se ScraperAPI ausente.
 */

const cheerio = require('cheerio');
const proxyFetch = require('./proxyFetch');

const TIMEOUT = 12000;

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function search({ q, modelo, filtros = {}, limit = 30 } = {}) {
  if (!q) throw new Error('q obrigatório');
  const fullQ = modelo && !q.toLowerCase().includes(modelo.toLowerCase())
    ? `${q} ${modelo}`
    : q;

  /* Monta URL: /<slug>?... — preço opcional */
  let url = `https://lista.mercadolivre.com.br/${slugify(fullQ)}`;
  const sp = new URLSearchParams();
  if (filtros.precoMin || filtros.precoMax) {
    const min = filtros.precoMin || 0;
    const max = filtros.precoMax || '';
    sp.set('price', `${min}-${max}`);
  }
  if (sp.toString()) url += `?${sp.toString()}`;

  let html;
  try {
    const resp = await proxyFetch.getViaScraperApi(url, {
      timeout: 30000,
      headers: {
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    html = resp.data;
  } catch (err) {
    const status = err.response?.status;
    const note = status === 403
      ? 'Mercado Livre bloqueou — Worker precisa permitir lista.mercadolivre.com.br'
      : null;
    console.warn('[mercadoLivre] busca falhou:', err.message);
    return { source: 'mercadolivre', results: [], error: err.message, note };
  }

  try {
    const $ = cheerio.load(html);
    const results = [];
    /* Cards de resultado — seletor estável da listagem ML */
    $('li.ui-search-layout__item, .ui-search-result, .poly-card').slice(0, limit).each((_i, el) => {
      const $el = $(el);
      const $link = $el.find('a.poly-component__title, a.ui-search-link, h2 a').first();
      const url = $link.attr('href') || $el.find('a[href*="/MLB-"]').first().attr('href');
      if (!url) return;
      const title = ($link.text() || $el.find('.poly-component__title, .ui-search-item__title').first().text() || '').trim();
      if (!title) return;

      /* Preço — várias variantes de DOM (depende da query renderizada) */
      const priceText = $el.find('.andes-money-amount__fraction').first().text().trim();
      const centsText = $el.find('.andes-money-amount__cents').first().text().trim();
      let price = null;
      if (priceText) {
        const integer = parseInt(priceText.replace(/\D/g, ''), 10);
        const cents = parseInt(centsText || '0', 10);
        if (Number.isFinite(integer)) price = integer + (Number.isFinite(cents) ? cents / 100 : 0);
      }

      const thumb = $el.find('img.poly-component__picture, img.ui-search-result-image__element').first().attr('src')
                || $el.find('img').first().attr('data-src')
                || $el.find('img').first().attr('src');
      const idMatch = url.match(/MLB-?(\d+)/);
      const externalId = idMatch ? `MLB${idMatch[1]}` : url;

      const freeShipping = $el.find('.poly-component__shipping, [class*="shipping"]').text().toLowerCase().includes('frete grátis');

      results.push({
        source: 'mercadolivre',
        externalId,
        title,
        price,
        currency: 'BRL',
        url: url.startsWith('http') ? url : `https://www.mercadolivre.com.br${url}`,
        thumbUrl: thumb && !thumb.startsWith('data:') ? thumb : null,
        location: null,
        raw: { freeShipping },
      });
    });
    return { source: 'mercadolivre', results };
  } catch (e) {
    console.warn('[mercadoLivre] parser falhou:', e.message);
    return { source: 'mercadolivre', results: [], error: 'parser falhou: ' + e.message };
  }
}

module.exports = { search };
