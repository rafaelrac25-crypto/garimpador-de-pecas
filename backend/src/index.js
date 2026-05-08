/* Garimpador de Peças — entrypoint do backend.
   Express + middleware de auth + serve do frontend buildado.
   Em prod (Vercel), o mesmo handler atende /api/* e o SPA. */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const auth = require('./middleware/auth');

const app = express();
app.disable('x-powered-by');

app.use(cors({ origin: process.env.FRONTEND_URL || true, credentials: false }));
app.use(express.json({ limit: '5mb' }));

/* Garante schema aplicado no boot. Idempotente — CREATE TABLE IF NOT EXISTS.
   Roda assíncrono pra não bloquear handlers (cold start fica responsivo). */
let schemaReady = null;
function ensureSchema() {
  if (!schemaReady) {
    schemaReady = require('./db/init')()
      .catch(err => console.error('[boot] init schema falhou:', err.message));
  }
  return schemaReady;
}
ensureSchema();
/* Middleware: em prod (Neon), garante que tabelas existam antes da 1ª request
   processar. Em dev SQLite, init local cobre — mas idempotente, sem custo. */
app.use(async (req, res, next) => { await ensureSchema(); next(); });

/* Rotas SEM auth de usuário (têm proteções próprias):
   - /api/health: monitor externo (público)
   - /api/cron:   Vercel manda Authorization: Bearer <CRON_SECRET> próprio */
app.use('/api/health', require('./routes/health'));
app.use('/api/cron', require('./routes/cron'));
app.use('/api/admin', require('./routes/admin'));
/* Proxy de imagens — sem auth, public, com allowlist de hosts */
app.use('/api/img', require('./routes/imgProxy'));
/* Callback OAuth Mercado Livre — sem auth do app (ML é quem redireciona) */
app.use('/api/ml-callback', require('./routes/mlCallback'));

/* Tudo abaixo de /api exige token de usuário (?key= ou X-Access-Key) */
app.use('/api', auth);

app.use('/api/ml', require('./routes/mlAuth'));

app.use('/api/search', require('./routes/search'));
app.use('/api/photo-search', require('./routes/photoSearch'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/offers', require('./routes/offers'));
app.use('/api/galeria', require('./routes/galeria'));
app.use('/api/alerts', require('./routes/alerts'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/diagnostics', require('./routes/diagnostics'));
app.use('/api/verify', require('./routes/verify'));
app.use('/api/vehicle', require('./routes/vehicle'));

/* Servir SPA do frontend (build). Em dev local sem build, retorna 404 — usa Vite direto na 5173. */
const distPath = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(distPath, {
  index: false,
  setHeaders: (res, file) => {
    if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
  },
}));
app.get('*', (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.sendFile(path.join(distPath, 'index.html'), (err) => {
    if (err) res.status(404).json({ error: 'Frontend não buildado. Rode npm run build em frontend/' });
  });
});

const PORT = process.env.PORT || 3001;
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`[garimpador] backend rodando na porta ${PORT}`);
  });
}

module.exports = app;
