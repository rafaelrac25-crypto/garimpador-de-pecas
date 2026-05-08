/* /api/img?url=... — proxy de imagens.
   OLX (img.olx.com.br) bloqueia hotlink retornando 403 sem Referer correto.
   Resolve servindo via backend, passando Referer da fonte. Cache 1h no
   browser pra não martelar. Allowlist de hosts pra não virar open proxy. */

const express = require('express');
const axios = require('axios');

const router = express.Router();

const ALLOWED_HOSTS = new Set([
  'img.olx.com.br',
  'imagens.olx.com.br',
  'http2.mlstatic.com',
  'mlstatic.com',
  'www.webmotors.com.br',
  'image.webmotors.com.br',
  'image-static.webmotors.com.br',
  'i.cdn.olx.com.br',
]);

function refererFor(host) {
  if (host.includes('olx.com.br'))      return 'https://www.olx.com.br/';
  if (host.includes('mlstatic'))         return 'https://www.mercadolivre.com.br/';
  if (host.includes('webmotors'))        return 'https://www.webmotors.com.br/';
  return undefined;
}

router.get('/', async (req, res) => {
  const target = req.query.url;
  if (!target || typeof target !== 'string') return res.status(400).send('missing url');
  let parsed;
  try { parsed = new URL(target); } catch { return res.status(400).send('invalid url'); }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) return res.status(403).send('host not allowed');

  try {
    const r = await axios.get(target, {
      timeout: 8000,
      responseType: 'arraybuffer',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        ...(refererFor(parsed.hostname) ? { 'Referer': refererFor(parsed.hostname) } : {}),
      },
      validateStatus: s => s >= 200 && s < 400,
    });
    res.setHeader('Content-Type', r.headers['content-type'] || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=3600, immutable');
    res.send(Buffer.from(r.data));
  } catch (err) {
    res.status(404).send('not found');
  }
});

module.exports = router;
