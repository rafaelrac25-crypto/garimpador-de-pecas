/**
 * Wrapper de fetch que opcionalmente roteia via Cloudflare Worker proxy.
 * Resolve o bloqueio anti-bot dos sites brasileiros (OLX, Web Motor) e do
 * ML que rejeitam IPs do datacenter Vercel.
 *
 * Auto-detect: se CLOUDFLARE_PROXY_URL + CLOUDFLARE_PROXY_KEY setadas, usa.
 * Senão, fetch direto (modo dev/local).
 */

const axios = require('axios');

function shouldProxy() {
  return !!(process.env.CLOUDFLARE_PROXY_URL && process.env.CLOUDFLARE_PROXY_KEY);
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

module.exports = { get, shouldProxy };
