/**
 * Logger central de erros — alimenta a aba Diagnósticos do app.
 *
 * Cada serviço/route que falha chama logError({...}) em vez de só console.warn.
 * Frontend lê via GET /api/diagnostics e mostra com botão "copiar" pro Rafa
 * mandar o código exato pro Claude quando precisar.
 *
 * IMPORTANTE: nunca logar tokens/secrets. context deve vir já sanitizado.
 */

const db = require('../db');

/**
 * @param {Object} args
 * @param {string} args.source     ex 'mercadoLivre', 'olx', 'partRecognition'
 * @param {string} [args.action]   ex 'search', 'verifyMatch'
 * @param {string|number} [args.code]  HTTP status ou código do erro
 * @param {string} args.message    mensagem (curta)
 * @param {Object} [args.context]  payload sanitizado pra debug (sem secrets)
 */
async function logError({ source, action, code, message, context }) {
  /* Não bloqueia o fluxo principal — best-effort */
  try {
    /* Sanitiza context: remove chaves que costumam carregar secret */
    const sanitized = context ? sanitize(context) : null;
    await db.query(
      `INSERT INTO error_logs (source, action, code, message, context)
       VALUES (?, ?, ?, ?, ?)`,
      [
        source || 'unknown',
        action || null,
        code != null ? String(code) : null,
        String(message || '').slice(0, 1000),
        sanitized ? JSON.stringify(sanitized).slice(0, 4000) : null,
      ]
    );
  } catch (err) {
    /* Logger falhou — só console pra não recursionar */
    console.warn('[errorLogger] falhou ao gravar log:', err.message);
  }
}

const SECRET_KEYS = /key|token|secret|auth|password|cookie|bearer|apikey/i;
function sanitize(obj, depth = 0) {
  if (depth > 4 || obj == null) return obj;
  if (Array.isArray(obj)) return obj.slice(0, 10).map(o => sanitize(o, depth + 1));
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SECRET_KEYS.test(k)) {
        out[k] = '[redacted]';
      } else {
        out[k] = sanitize(v, depth + 1);
      }
    }
    return out;
  }
  if (typeof obj === 'string' && obj.length > 500) return obj.slice(0, 500) + '…';
  return obj;
}

module.exports = { logError };
