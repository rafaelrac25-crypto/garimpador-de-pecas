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

/* Rotas públicas (sem auth) — health pra monitor externo */
app.use('/api/health', require('./routes/health'));

/* Tudo abaixo de /api exige token (?key= ou X-Access-Key) */
app.use('/api', auth);

app.use('/api/search', require('./routes/search'));
app.use('/api/photo-search', require('./routes/photoSearch'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/ai', require('./routes/ai'));

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
