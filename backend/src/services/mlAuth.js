/**
 * OAuth Mercado Livre — single-user (Rafa autoriza 1 vez, persistido no DB).
 *
 * Fluxo:
 *   1) Frontend chama /api/ml/start → redireciona pro ML
 *   2) ML redireciona pra /api/ml-callback?code=... → backend troca por
 *      access_token (6h) + refresh_token (rotativo, ~6 meses)
 *   3) saveTokens grava na tabela ml_tokens (id=1)
 *   4) getAccessToken() lê do DB; se expirado, refresca; retorna válido
 *
 * Por que OAuth user e não Client Credentials:
 *   ML mudou política em 2024 — /sites/MLB/search retorna 403 com
 *   client_credentials. Só access_token de usuário (autorizado) funciona.
 */

const axios = require('axios');
const db = require('../db');

const ML_OAUTH_TOKEN = 'https://api.mercadolibre.com/oauth/token';
const ML_AUTHORIZE = 'https://auth.mercadolivre.com.br/authorization';

function clientId() { return process.env.ML_CLIENT_ID; }
function clientSecret() { return process.env.ML_CLIENT_SECRET; }
function redirectUri() {
  return process.env.ML_REDIRECT_URI
      || `${process.env.PUBLIC_BASE_URL || ''}/api/ml-callback`;
}

function isConfigured() {
  return !!(clientId() && clientSecret() && redirectUri());
}

function getAuthorizeUrl(state = '') {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId(),
    redirect_uri: redirectUri(),
    /* offline_access pede ML pra retornar refresh_token (válido ~6 meses) */
    scope: 'offline_access read',
  });
  if (state) params.set('state', state);
  return `${ML_AUTHORIZE}?${params.toString()}`;
}

async function exchangeCode(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: clientId(),
    client_secret: clientSecret(),
    code,
    redirect_uri: redirectUri(),
  });
  const resp = await axios.post(ML_OAUTH_TOKEN, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    timeout: 10000,
  });
  return resp.data;
}

async function refresh(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: clientId(),
    client_secret: clientSecret(),
    refresh_token: refreshToken,
  });
  const resp = await axios.post(ML_OAUTH_TOKEN, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    timeout: 10000,
  });
  return resp.data;
}

async function saveTokens({ access_token, refresh_token, expires_in, user_id }) {
  const expiresAt = new Date(Date.now() + (Number(expires_in) || 21600) * 1000).toISOString();
  /* refresh_token pode vir null se App ML não pediu offline_access ou for App
     pública. Salvamos null nesse caso — quando access_token expirar (6h), o
     getAccessToken retorna null e Rafa reautoriza clicando o chip ML. */
  await db.query('DELETE FROM ml_tokens WHERE id = ?', [1]);
  await db.query(
    'INSERT INTO ml_tokens (id, access_token, refresh_token, expires_at, user_id) VALUES (?, ?, ?, ?, ?)',
    [1, access_token, refresh_token || null, expiresAt, user_id ? String(user_id) : null]
  );
}

async function loadTokens() {
  const r = await db.query('SELECT * FROM ml_tokens WHERE id = ?', [1]);
  return r.rows?.[0] || null;
}

/** Retorna access_token válido (refresca se faltar < 5 min). null se nunca conectou. */
async function getAccessToken() {
  const t = await loadTokens();
  if (!t) return null;
  const expMs = new Date(t.expires_at).getTime();
  const safetyWindowMs = 5 * 60 * 1000;
  if (Date.now() < expMs - safetyWindowMs) return t.access_token;
  /* Sem refresh_token → não há como renovar; Rafa precisa reautorizar */
  if (!t.refresh_token) {
    console.warn('[mlAuth] access_token expirou e sem refresh_token — reautorize via /api/ml/start');
    return null;
  }
  try {
    const fresh = await refresh(t.refresh_token);
    await saveTokens(fresh);
    return fresh.access_token;
  } catch (err) {
    console.warn('[mlAuth] refresh falhou:', err?.response?.data || err.message);
    return null;
  }
}

async function status() {
  const t = await loadTokens();
  if (!t) return { connected: false, configured: isConfigured() };
  const expMs = new Date(t.expires_at).getTime();
  return {
    connected: true,
    configured: isConfigured(),
    user_id: t.user_id || null,
    expires_at: t.expires_at,
    expires_in_min: Math.max(0, Math.round((expMs - Date.now()) / 60000)),
  };
}

module.exports = {
  isConfigured,
  getAuthorizeUrl,
  exchangeCode,
  saveTokens,
  loadTokens,
  getAccessToken,
  status,
  redirectUri,
};
