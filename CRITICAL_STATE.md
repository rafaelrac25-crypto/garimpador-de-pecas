# CRITICAL_STATE — Garimpador de Peças

## 🎯 CHECKPOINT — 2026-05-07 — PROJETO CRIADO (FASE 0 EM ANDAMENTO)

**Pasta criada:** `C:\Users\Rafa\garimpador-de-pecas`

**Plano completo:** `C:\Users\Rafa\.claude\plans\resolva-o-que-tinha-smooth-pearl.md`

### Decisões fundadoras
- **Nome:** Garimpador de Peças (display) / `garimpador-de-pecas` (path/repo/Vercel)
- **Foco principal:** Chevrolet C10 e C14 (caminhonetes clássicas)
- **Auth:** token na URL via `?key=...` → header `X-Access-Key` em chamadas API
- **Plataforma:** mobile-first, desktop usável ≥1024px
- **Fontes MVP:** Mercado Livre (API), OLX (scraping cheerio), Web Motor (cheerio/Playwright)
- **Marketplace FB:** deferido (sem API pública)
- **IA:** Groq llama-4-scout (vision) primária, Gemini 2.0 Flash backup
- **Stack:** Vite + React + Express + SQLite/PG Neon — espelho da metodologia AdManager

### Status de cada fase
- [ ] Fase 0 — Bootstrap (em andamento)
- [ ] Fase 1 — Auth + visual base mobile-first
- [ ] Fase 2 — Busca Mercado Livre
- [ ] Fase 3 — Busca OLX
- [ ] Fase 4 — Busca Web Motor
- [ ] Fase 5 — Reconhecimento de imagem
- [ ] Fase 6 — Favoritos + histórico
- [ ] Fase 7 — Alerta de queda de preço
- [ ] Fase 8 — Polimento + smoke test em prod

### Pendências externas (Rafa)
- Criar repo GitHub `garimpador-de-pecas` (público ou privado)
- Conectar Vercel → autorizar o repo → setar env vars (`ACCESS_KEY`, `GROQ_API_KEY`, `DATABASE_URL`, `CRON_SECRET`)
- Decidir domínio (default `garimpador-de-pecas.vercel.app`)
