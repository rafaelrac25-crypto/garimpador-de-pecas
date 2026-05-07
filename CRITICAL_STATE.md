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

## 🚧 FASES FUTURAS (deferidas conscientemente — anotar pra não esquecer)

### Oficinas em Joinville (especializadas em carro antigo)
Pedida pelo Rafa em 2026-05-07. Implementar DEPOIS do MVP.

**Visão:**
- Lista/mapa de oficinas em Joinville
- Filtros por especialização: motor, suspensão, direção hidráulica, freios, **lataria e pintura** (especialmente projetos especiais de carro antigo)
- Pra cada oficina: endereço, avaliação Google, comentários, fotos, telefone
- UX: busca fácil por proximidade ("oficinas mais perto") OU por assunto específico
- Bonus: marcar oficinas que já trabalharam com C10/C14 ou caminhonete antiga (fotos identificam)

**Fonte de dados (a investigar quando entrar):**
- Google Places API (Nearby Search + Place Details) — free tier 1000 req/mês
- Google Maps Reviews via scraping (dependendo do volume)
- Manualmente curado (Rafa adiciona oficinas que conhece) com sync periódico do Google

**Categorias de especialização (decisão de produto):**
- Motor / retífica
- Suspensão
- Direção hidráulica
- Freios
- Lataria e pintura (com sub-tag "projetos especiais carro antigo")
- Elétrica auto
- Carburação / injeção
- Mecânica geral

### FB Marketplace
Pedida pelo Rafa pra entrar depois do MVP. Caminho viável: Playwright local com sessão logada do Rafa, scraping da página de Marketplace + filtro de busca. Cron local agendado em Task Scheduler do Windows que popula DB. Frontend Vercel só lê do DB.

### PWA (Progressive Web App)
Adicionar `manifest.json` + service worker simples → permite instalar o app no celular como ícone na tela inicial. Sem app nativo, sem custos.

---

## ⚠️ PENDÊNCIAS DE CONFIGURAÇÃO (ação do Rafa)

1. **GROQ_API_KEY**: harness bloqueou reuso da chave do AdManager (correto). Opções:
   - Autorizar reuso (basta me dizer "pode usar a chave do criscosta")
   - OU criar conta nova em https://console.groq.com (free tier generoso)

2. **ML_ACCESS_TOKEN**: Mercado Livre exige App registrada desde 2024.
   - Registrar grátis em https://developers.mercadolivre.com.br/devcenter
   - Pegar Client ID + Secret → gerar Access Token (sem necessidade de OAuth user)
   - Sem isso, ML não retorna nada (mas OLX e Web Motor seguem normais)

3. **GitHub repo + Vercel**: depois das fases backend, vou pedir Rafa criar repo `garimpador-de-pecas` (gh ou web) e conectar Vercel. Vou adicionar ADMIN_KEY/CRON_SECRET nas envs prod.

4. **Postgres Neon**: criar projeto novo no Neon (free tier) e me passar `DATABASE_URL`. Pra prod só — local segue com SQLite.
