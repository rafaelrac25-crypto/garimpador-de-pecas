/**
 * Wrapper de fetch que opcionalmente roteia via Cloudflare Worker proxy.
 * Resolve o bloqueio anti-bot dos sites brasileiros (OLX, Web Motor) e do
 * ML que rejeitam IPs do datacenter Vercel.
 *
 * Auto-detect: se CLOUDFLARE_PROXY_URL + CLOUDFLARE_PROXY_KEY setadas, usa.
 * Senão, fetch direto (modo dev/local).
 *
 * getViaScraperApi: caminho alternativo via ScraperAPI (proxy residencial).
 * Necessário pro ML — anti-bot do ML detecta o Worker CF como suspicious-traffic.
 */

const axios = require('axios');

function shouldProxy() {
  return !!(process.env.CLOUDFLARE_PROXY_URL && process.env.CLOUDFLARE_PROXY_KEY);
}

function shouldScraperApi() {
  return !!process.env.SCRAPERAPI_KEY;
}

/**
 * @param {string} url   URL alvo (será encodada e enviada via ?url=)
 * @param {Object} opts  axios opts (timeout, params, headers, responseType)
 */
async function get(url, opts = {}) {
  if (!shouldProxy()) {
    return axios.get(url, opts);
  }
  /* Monta URL final juntando params do axios na URL alvo (proxy só recebe ?url=) */
  let finalUrl = url;
  if (opts.params) {
    const sp = new URLSearchParams(opts.params).toString();
    finalUrl += (finalUrl.includes('?') ? '&' : '?') + sp;
  }
  const proxyBase = process.env.CLOUDFLARE_PROXY_URL.replace(/\/$/, '');
  const proxyUrl = `${proxyBase}/?url=${encodeURIComponent(finalUrl)}`;
  return axios.get(proxyUrl, {
    timeout: opts.timeout || 12000,
    responseType: opts.responseType || 'text',
    headers: {
      'X-Proxy-Key': process.env.CLOUDFLARE_PROXY_KEY,
      'Accept': opts.headers?.Accept || 'text/html,application/json',
    },
    transformResponse: opts.responseType === 'arraybuffer' ? undefined : [(d) => d],
    /* Evita axios tentar parsear como JSON quando não é */
  });
}

/**
 * Versão via ScraperAPI (proxy residencial brasileiro).
 * Usar quando o site bloqueia o Cloudflare Worker (caso do Mercado Livre).
 *
 * Free tier: 1000 credits/mês; sem render JS = 1 credit por request.
 * country_code=br força IP nacional (ML é mais permissivo com IP brasileiro).
 *
 * Fallback: se SCRAPERAPI_KEY não setada, cai pro `get` (Worker CF ou direto).
 */
async function getViaScraperApi(url, opts = {}) {
  if (!shouldScraperApi()) {
    return get(url, opts);
  }
  let finalUrl = url;
  if (opts.params) {
    const sp = new URLSearchParams(opts.params).toString();
    finalUrl += (finalUrl.includes('?') ? '&' : '?') + sp;
  }
  /* SCRAPERAPI_PREMIUM=true ativa proxies premium (necessário pra
     Protected Domains tipo Mercado Livre). Só funciona em planos pagos —
     free tier retorna 403. Default off. Custa 10 credits/req. */
  const usePremium = process.env.SCRAPERAPI_PREMIUM === 'true';
  const apiUrl = 'https://api.scraperapi.com/'
    + `?api_key=${process.env.SCRAPERAPI_KEY}`
    + `&url=${encodeURIComponent(finalUrl)}`
    + `&country_code=br`
    + (usePremium ? `&premium=true` : '');
  return axios.get(apiUrl, {
    timeout: opts.timeout || 60000,
    responseType: opts.responseType || 'text',
    headers: {
      'Accept': opts.headers?.Accept || 'text/html,application/xhtml+xml',
    },
    transformResponse: opts.responseType === 'arraybuffer' ? undefined : [(d) => d],
  });
}

module.exports = { get, getViaScraperApi, shouldProxy, shouldScraperApi };
