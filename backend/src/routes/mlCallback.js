/* /api/ml-callback — recebe code do Mercado Livre, troca por tokens.
   SEM auth do app: ML é quem chama (não tem header X-Access-Key).
   Segurança: code só vale 1x e exige client_secret pra trocar. */

const express = require('express');
const mlAuth = require('../services/mlAuth');

const router = express.Router();

router.get('/', async (req, res) => {
  const { code, error: oauthError, error_description } = req.query;
  if (oauthError) {
    return res.status(400).send(htmlPage(`Autorização ML negada: ${oauthError} — ${error_description || ''}`));
  }
  if (!code) return res.status(400).send(htmlPage('Faltou parâmetro code do Mercado Livre.'));

  try {
    const tokens = await mlAuth.exchangeCode(code);
    await mlAuth.saveTokens(tokens);
    /* Sucesso — redireciona pro app (sem ?key= aqui; o browser do Rafa já tem em localStorage) */
    res.send(htmlPage('Mercado Livre conectado! Voltando ao app…', /* redirect */ '/'));
  } catch (err) {
    console.warn('[mlCallback] troca de code falhou:', err?.response?.data || err.message);
    res.status(500).send(htmlPage(`Falha ao trocar código: ${err?.response?.data?.message || err.message}`));
  }
});

function htmlPage(msg, redirectTo = null) {
  const meta = redirectTo ? `<meta http-equiv="refresh" content="2;url=${redirectTo}">` : '';
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">${meta}<title>Garimpador — ML</title>
<style>body{font-family:system-ui;background:#F2EBDD;color:#5A3825;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;padding:24px;text-align:center}
.box{background:#fff;border:1px solid #d8caaa;border-radius:8px;padding:32px;max-width:420px;box-shadow:0 4px 20px rgba(90,56,37,.08)}
a{color:#B8362A;text-decoration:none;font-weight:600}</style></head>
<body><div class="box"><h2 style="margin-top:0">Mercado Livre</h2><p>${escapeHtml(msg)}</p>${redirectTo ? `<p><a href="${redirectTo}">Abrir o app</a></p>` : ''}</div></body></html>`;
}
function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

module.exports = router;
