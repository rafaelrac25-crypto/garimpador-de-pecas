/**
 * Scraping da OLX (peças de carro).
 *
 * URL pattern: https://www.olx.com.br/autos-e-pecas/pecas-e-acessorios?q=...
 * Sem API pública. HTML pode mudar — implementação requer manutenção esporádica.
 *
 * Estratégia: OLX serve uma `__NEXT_DATA__` script tag com JSON estruturado
 * dos resultados (Next.js SSR). Mais estável que parsear DOM cru.
 */

const axios = require('axios');
const cheerio = require('cheerio');
const proxyFetch = require('./proxyFetch');

/* URL geral de busca da OLX — busca em todas categorias com filtro de termo.
   A URL específica de "/autos-e-pecas/pecas-e-acessorios" retorna 404 sem
   UF/cidade. Esta URL global filtra por palavra-chave em qualquer região. */
const OLX_BASE = 'https://www.olx.com.br/brasil';
const TIMEOUT = 10000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function search({ q, modelo, filtros = {}, limit = 30 } = {}) {
  if (!q) throw new Error('q obrigatório');
  const fullQ = modelo && !q.toLowerCase().includes(modelo.toLowerCase())
    ? `${q} ${modelo}`
    : q;

  const params = { q: fullQ };
  if (filtros.precoMin) params.ps = filtros.precoMin;
  if (filtros.precoMax) params.pe = filtros.precoMax;

  let html;
  try {
    /* Usa Cloudflare Worker proxy quando configurado (resolve bloqueio Vercel) */
    const resp = await proxyFetch.get(OLX_BASE, {
      params,
      timeout: TIMEOUT,
      headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' },
    });
    html = resp.data;
  } catch (err) {
    console.warn('[olx] busca falhou:', err.message);
    return { source: 'olx', results: [], error: err.message };
  }

  /* Tenta extrair __NEXT_DATA__ — OLX usa Next.js, dados vêm em JSON estruturado */
  try {
    const $ = cheerio.load(html);
    const nextDataRaw = $('#__NEXT_DATA__').html();
    if (nextDataRaw) {
      const data = JSON.parse(nextDataRaw);
      const ads = data?.props?.pageProps?.ads
                || data?.props?.pageProps?.listingProps?.ads
                || data?.props?.pageProps?.searchProps?.ads
                || [];
      if (Array.isArray(ads) && ads.length > 0) {
        return {
          source: 'olx',
          results: ads.slice(0, limit).map(normalizeNextData),
        };
      }
    }
  } catch (e) {
    console.warn('[olx] falha ao parsear __NEXT_DATA__:', e.message);
  }

  /* Fallback: parser de DOM (mais frágil, manutenção esporádica) */
  try {
    const $ = cheerio.load(html);
    const results = [];
    /* Seletor heurístico — OLX usa data-ds-component="DS-AdCard" ou similar */
    $('a[data-ds-component="DS-AdCard"], a[data-testid="adcard"]').slice(0, limit).each((_i, el) => {
      const $el = $(el);
      const url = $el.attr('href');
      const title = $el.find('h2').first().text().trim();
      const priceText = $el.find('[data-ds-component="DS-Price"]').first().text().trim()
                     || $el.find('[class*="price"]').first().text().trim();
      const thumb = $el.find('img').first().attr('src');
      if (url && title) {
        results.push({
          source: 'olx',
          externalId: extractIdFromUrl(url),
          title,
          price: parsePriceBR(priceText),
          currency: 'BRL',
          url: url.startsWith('http') ? url : `https://www.olx.com.br${url}`,
          thumbUrl: thumb,
          location: null,
        });
      }
    });
    return { source: 'olx', results };
  } catch (e) {
    console.warn('[olx] falha no parser DOM:', e.message);
    return { source: 'olx', results: [], error: 'parser falhou' };
  }
}

function normalizeNextData(ad) {
  /* OLX às vezes manda priceValue (número) e às vezes price (string formatada).
     Garante que o output sempre é número ou null — frontend conta com isso. */
  let priceNum = null;
  if (Number.isFinite(ad.priceValue)) priceNum = ad.priceValue;
  else if (typeof ad.price === 'number') priceNum = ad.price;
  else if (ad.price) priceNum = parsePriceBR(ad.price);
  if (!Number.isFinite(priceNum) || priceNum <= 0) priceNum = null;

  return {
    source: 'olx',
    externalId: String(ad.listId || ad.id || ad.url),
    title: ad.subject || ad.title,
    price: priceNum,
    currency: 'BRL',
    url: ad.url,
    thumbUrl: ad.thumbnail || ad.images?.[0]?.original || null,
    location: [ad.location?.neighbourhood, ad.location?.municipality, ad.location?.uf].filter(Boolean).join(' - ') || null,
    raw: { datePosted: ad.date || ad.listTime },
  };
}

function parsePriceBR(text) {
  if (!text) return null;
  const cleaned = String(text).replace(/[^\d,]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return Number.isFinite(num) ? num : null;
}

function extractIdFromUrl(url) {
  const m = String(url).match(/\d{6,}/);
  return m ? m[0] : url;
}

module.exports = { search };
