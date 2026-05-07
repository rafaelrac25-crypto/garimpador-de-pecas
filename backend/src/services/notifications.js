/**
 * Emissão de notificações.
 *
 * Canais (cada um opcional):
 *   - in-app: grava em tabela notifications (sino do header)
 *   - email: via Resend (RESEND_API_KEY) — free tier 100 emails/dia
 *   - whatsapp: via CallMeBot (CALLMEBOT_APIKEY) — free, número precisa ter
 *     adicionado o CallMeBot como contato uma vez
 *
 * Sem nenhum canal configurado, fica só in-app (sempre disponível).
 */

const axios = require('axios');
const db = require('../db');

/**
 * @param {Object} args
 * @param {'price_alert'|'system'|'info'} args.kind
 * @param {string} args.title
 * @param {string} [args.message]
 * @param {string} [args.link]   URL externa (ex: anúncio que disparou)
 * @param {Object} [args.metadata]
 * @param {string} [args.email_to]    se setado, envia email via Resend
 * @param {string} [args.whatsapp_to] se setado, envia WA via CallMeBot
 */
async function emit({ kind = 'info', title, message, link, metadata, email_to, whatsapp_to }) {
  const results = { in_app: false, email: false, whatsapp: false };

  /* In-app sempre — base do sistema */
  try {
    await db.query(
      'INSERT INTO notifications (kind, title, message, link, metadata) VALUES (?, ?, ?, ?, ?)',
      [kind, title, message || null, link || null, metadata ? JSON.stringify(metadata) : null]
    );
    results.in_app = true;
  } catch (err) {
    console.warn('[notifications] in-app falhou:', err.message);
  }

  /* Email via Resend (https://resend.com — free 100/dia) */
  if (email_to && process.env.RESEND_API_KEY) {
    try {
      await axios.post('https://api.resend.com/emails', {
        from: process.env.RESEND_FROM || 'Garimpador <onboarding@resend.dev>',
        to: email_to,
        subject: title,
        text: [message, link].filter(Boolean).join('\n\n'),
      }, {
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}` },
        timeout: 8000,
      });
      results.email = true;
    } catch (err) {
      console.warn('[notifications] email falhou:', err.response?.data || err.message);
    }
  }

  /* WhatsApp via CallMeBot — número precisa ter aceito o bot uma vez.
     Doc: https://www.callmebot.com/blog/free-api-whatsapp-messages/ */
  if (whatsapp_to && process.env.CALLMEBOT_APIKEY) {
    try {
      const text = encodeURIComponent([title, message, link].filter(Boolean).join(' — '));
      const phone = whatsapp_to.replace(/\D/g, '');
      await axios.get('https://api.callmebot.com/whatsapp.php', {
        params: { phone, text: decodeURIComponent(text), apikey: process.env.CALLMEBOT_APIKEY },
        timeout: 8000,
      });
      results.whatsapp = true;
    } catch (err) {
      console.warn('[notifications] whatsapp falhou:', err.message);
    }
  }

  return results;
}

module.exports = { emit };
