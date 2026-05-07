/* Middleware de auth via token simples.
   Aceita o token em ?key=... (URL) ou no header X-Access-Key.
   Sem ACCESS_KEY definido (dev), libera. Em prod, exige match. */

const crypto = require('crypto');

function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

module.exports = function auth(req, res, next) {
  const expected = (process.env.ACCESS_KEY || '').trim();
  if (!expected) return next();  /* dev mode: sem chave configurada, libera */

  const got = (req.query.key || req.headers['x-access-key'] || '').toString().trim();
  if (!got) return res.status(401).json({ error: 'token de acesso obrigatório' });
  if (!safeEqual(got, expected)) return res.status(401).json({ error: 'token inválido' });
  return next();
};
