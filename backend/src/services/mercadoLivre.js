/**
 * Wrapper da API do Mercado Livre.
 *
 * Doc: https://api.mercadolibre.com/sites/MLB/search?q=...
 *
 * IMPORTANTE: ML mudou política em 2024 — busca sem App registrado retorna
 * 403. Pra funcionar, é preciso registrar uma App grátis em
 * https://developers.mercadolivre.com.br/devcenter e configurar:
 *   ML_ACCESS_TOKEN  — token de acesso da App (sem necessidade de OAuth user)
 *
 * Sem o token, esta service retorna vazio com flag de erro (e o consolidador
 * continua chamando OLX e Web Motor). Quando o Rafa configurar, ML volta.
 *
 * Categorias úteis:
 *   MLB1747  — Carros, Motos e Outros (top-level)
 *   MLB5672  — Acessórios para Veículos
 *   MLB1763  — Peças de Carros e Caminhonetes
 */

const axios = require('axios');
const proxyFetch = require('./proxyFetch');

const ML_BASE = 'https://api.mercadolibre.com/sites/MLB/search';
const TIMEOUT = 8000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

/**
 * @param {Object} params
 * @param {string} params.q  termo de busca
 * @param {string} [params.modelo]   ex: 'C10' — anexa à query pra precisão
 * @param {Object} [params.filtros]
 * @param {number} [params.filtros.precoMin]
 * @param {number} [params.filtros.precoMax]
 * @param {string} [params.filtros.condicao]   'new'|'used'
 * @param {string} [params.filtros.estado]     'SP', 'RJ', etc
 * @param {number} [params.limit]   default 30
 */
async function search({ q, modelo, filtros = {}, limit = 30 } = {}) {
  if (!q) throw new Error('q (termo de busca) obrigatório');

  /* Compõe query: se modelo presente e não está na query, anexa */
  const fullQ = modelo && !q.toLowerCase().includes(modelo.toLowerCase())
    ? `${q} ${modelo}`
    : q;

  const params = {
    q: fullQ,
    limit: Math.min(limit, 50),
    category: 'MLB1747',
  };
  if (filtros.precoMin) params.price = `${filtros.precoMin}-*`;
  if (filtros.precoMax) params.price = `${filtros.precoMin || 0}-${filtros.precoMax}`;
  if (filtros.condicao === 'new') params.condition = 'new';
  if (filtros.condicao === 'used') params.condition = 'used';
  if (filtros.estado) params.state = filtros.estado;

  /* OAuth user token (Rafa autoriza 1x via /api/ml/start; refresh automático).
     Sem token salvo → ML retorna 403 e a busca segue só com OLX/Web Motor. */
  const headers = { 'User-Agent': UA, 'Accept': 'application/json' };
  const mlAuth = require('./mlAuth');
  const userToken = await mlAuth.getAccessToken();
  if (userToken) {
    headers['Authorization'] = `Bearer ${userToken}`;
  } else if (process.env.ML_ACCESS_TOKEN) {
    /* Fallback legado — token manual via env */
    headers['Authorization'] = `Bearer ${process.env.ML_ACCESS_TOKEN}`;
  }

  let resp;
  try {
    resp = await proxyFetch.get(ML_BASE, { params, timeout: TIMEOUT, headers });
  } catch (err) {
    /* 403 = sem OAuth user válido. ML mudou política em 2024.
       Não derruba a busca — OLX/Web Motor seguem rodando. */
    const status = err.response?.status;
    const note = status === 403
      ? 'Mercado Livre desconectado — clique em Conectar ML no app'
      : null;
    console.warn('[mercadoLivre] busca falhou:', err.message);
    return { source: 'mercadolivre', results: [], error: err.message, note, needsAuth: status === 403 };
  }

  /* proxyFetch retorna body cru (text). Se vier string, parsea como JSON */
  let data = resp.data;
  if (typeof data === 'string') {
    try { data = JSON.parse(data); } catch { data = {}; }
  }
  const items = data?.results || [];
  const results = items.map(normalize);
  return { source: 'mercadolivre', results, total: data?.paging?.total };
}

/* Normaliza shape do item ML pro shape comum do app */
function normalize(item) {
  return {
    source: 'mercadolivre',
    externalId: item.id,
    title: item.title,
    price: item.price,
    currency: item.currency_id || 'BRL',
    condition: item.condition,
    url: item.permalink,
    thumbUrl: item.thumbnail?.replace('http:', 'https:'),
    location: item.address ? [item.address.city_name, item.address.state_id].filter(Boolean).join(' - ') : null,
    seller: item.seller?.nickname || null,
    raw: {
      acceptsMercadoPago: item.accepts_mercadopago,
      shipping: item.shipping?.free_shipping || false,
      soldQuantity: item.sold_quantity,
    },
  };
}

module.exports = { search };
