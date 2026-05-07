/**
 * Web Motors — vertical de carros + peças.
 *
 * NOTA: Web Motors é SPA (Next.js) — fetch direto pode não retornar resultados
 * sem JS. Tentamos primeiro extrair `__NEXT_DATA__` (igual OLX). Se vazio,
 * deixa documentado pra Fase futura com Playwright local.
 *
 * URL aproximada: https://www.webmotors.com.br/pecas?busca=<termo>
 *                 (URL real pode mudar — confirmar no primeiro teste)
 */

const axios = require('axios');
const cheerio = require('cheerio');
const proxyFetch = require('./proxyFetch');

const WEBMOTORS_SEARCH = 'https://www.webmotors.com.br/pecas';
const TIMEOUT = 10000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

async function search({ q, modelo, filtros = {}, limit = 30 } = {}) {
  if (!q) throw new Error('q obrigatório');
  const fullQ = modelo && !q.toLowerCase().includes(modelo.toLowerCase())
    ? `${q} ${modelo}`
    : q;

  let html;
  try {
    const resp = await proxyFetch.get(WEBMOTORS_SEARCH, {
      params: { busca: fullQ },
      timeout: TIMEOUT,
      headers: { 'User-Agent': UA, 'Accept-Language': 'pt-BR,pt;q=0.9' },
    });
    html = resp.data;
  } catch (err) {
    /* 404 ou redirect — Web Motors pode ter mudado URL. Não falha tudo. */
    console.warn('[webmotors] busca falhou:', err.message);
    return { source: 'webmotors', results: [], error: err.message };
  }

  try {
    const $ = cheerio.load(html);
    const nextDataRaw = $('#__NEXT_DATA__').html();
    if (nextDataRaw) {
      const data = JSON.parse(nextDataRaw);
      /* Tenta caminhos prováveis — estrutura interna Webmotors muda */
      const items = findArrayDeep(data, 'items')
                 || findArrayDeep(data, 'pecas')
                 || findArrayDeep(data, 'results')
                 || [];
      if (items.length > 0) {
        return {
          source: 'webmotors',
          results: items.slice(0, limit).map(normalizeNextData),
        };
      }
    }
  } catch (e) {
    console.warn('[webmotors] parser __NEXT_DATA__ falhou:', e.message);
  }

  /* Sem dados — provavelmente requer JS (SPA). Fica documentado pra refator
     com Playwright local quando o Rafa quiser. */
  return {
    source: 'webmotors',
    results: [],
    note: 'Web Motors retornou HTML sem dados estruturados — provavelmente requer Playwright local pra renderizar JS.',
  };
}

/** Busca recursiva por chave em objeto aninhado (qualquer profundidade) */
function findArrayDeep(obj, key, depth = 0) {
  if (!obj || depth > 8) return null;
  if (Array.isArray(obj[key])) return obj[key];
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      const found = findArrayDeep(obj[k], key, depth + 1);
      if (found) return found;
    }
  }
  return null;
}

function normalizeNextData(item) {
  const url = item.url || item.link || (item.id ? `https://www.webmotors.com.br/pecas/${item.id}` : '');
  return {
    source: 'webmotors',
    externalId: String(item.id || item.codigo || url),
    title: item.titulo || item.title || item.descricao || item.nome || '',
    price: item.preco || item.price || item.valor || null,
    currency: 'BRL',
    url,
    thumbUrl: item.imagem || item.thumbnail || item.image || null,
    location: item.localizacao || item.location || null,
  };
}

module.exports = { search };
