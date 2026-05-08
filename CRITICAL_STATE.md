# CRITICAL_STATE — Garimpador de Peças

## ✓ CHECKPOINT — 2026-05-07 — PROD LIVE + DOMÍNIO c14docosta + IMG PROXY (commit c36944b)

**Estado atual:**
- **URL prod:** `https://c14docosta.vercel.app` (renomeado de garimpador-de-pecas)
- **Sem gate de token** — entra direto. ACCESS_KEY env removida do Vercel.
- **Postgres Neon ativo** (DATABASE_URL via integration), schema rodado (9 tabelas).
- **OLX funcionando 100%** com filtro pós-processamento C10/C14 (rejeita Nissan/Honda/VW/Chevrolet moderno; aceita família D10/D20/A10/A20/Bonanza/Veraneio/Opala/Caravan).
- **Image proxy `/api/img`** — bypass do hotlink protection da OLX. Frontend usa helper `proxyImg()` em Home.jsx + Results.jsx. Testado: imagem JPEG 960×1280 carrega.
- **OAuth ML conectado** mas **ML bloqueia scraping** mesmo via Cloudflare (anti-bot retorna página "suspicious-traffic"). API oficial /sites/MLB/search retorna 403 mesmo com token user (política 2024).
- **Switch de modelo na home** mostra C10/C14/D10/A10/A20/C15/**Outro** (input livre pra Opala/Fusca/Maverick/etc).

**Smoke test 2026-05-07 23:40 UTC:**
- /api/health 200 ✓ (db_url:true, gemini:true, access_key:false)
- /api/ml/status 200 ✓ (connected:true)
- /api/vehicle 200 ✓ (C14 do Costa pré-populado)
- /api/offers/featured?modelo=C10 200 ✓ (resultados OLX)
- /api/admin/tables 200 ✓ (9 tabelas)
- /api/search 200 ✓ (filtro C10 ativo, OLX retornando)
- /api/img?url=<olx> 200 ✓ (imagem real)
- /api/galeria 200 (vazio — sem IG token)

**ML — caminhos viáveis pra resolver (escolher próxima sessão):**
- **A) ScraperAPI free** (1000 req/mês — recomendado): cadastro grátis em scraperapi.com, integro como provider de proxy residencial.
- **B) Browserless.io free** (6h/mês): headless browser remoto.
- **C) Playwright local no PC do Rafa**: script que coleta on-demand.
- **D) Aceitar só OLX** (status atual; cobre bem C10/C14).

### Pendências próxima sessão (ordem de impacto)
1. Decidir caminho do ML (A/B/C/D)
2. Galeria @c14docosta na home (token IG via Meta Developers ou fotos estáticas curadas)
3. Carrossel rico de ofertas em destaque (visual)
4. PWA (manifest.json + ícone — instala como app no celular)
5. Filtro inteligente generalizado pra outros modelos (Opala/Fusca/etc)
6. Oficinas em Joinville (mapa Google Places — fase futura)
7. FB Marketplace (Playwright local — fase futura)
8. Refinos visuais (Rafael é designer, vai pintar depois)

### Configurado no Vercel (env vars ativas)
- DATABASE_URL ✓ (Neon integration)
- GEMINI_API_KEY ✓
- ML_CLIENT_ID, ML_CLIENT_SECRET, ML_REDIRECT_URI ✓
- CLOUDFLARE_PROXY_URL, CLOUDFLARE_PROXY_KEY ✓
- (não setadas: ACCESS_KEY removido propositalmente, GROQ_API_KEY, IG_ACCESS_TOKEN, RESEND_API_KEY, CALLMEBOT_APIKEY, CRON_SECRET)

### Cloudflare Worker
- URL: `https://jolly-sky-64e9.rafaelrac25.workers.dev`
- Allowlist corrigida (lista.mercadolivre.com.br com V de "livre")

### Banco
- Tabelas: searches, favorites, alerts, price_alerts, notifications, error_logs, vehicle, maintenance_logs, ml_tokens
- Vehicle row id=1 pré-populado: "C14 do Costa", Chevrolet C14, ano 1964
- ml_tokens.refresh_token agora nullable (ML não retornou refresh_token na primeira autorização)

---

## ✓ CHECKPOINT — 2026-05-07 — PROXY CF + OAUTH ML LIGADOS (commit 46d5048)

**O que mudou nesta sessão:**
- **Cloudflare Worker proxy** criado e funcionando (`https://jolly-sky-64e9.rafaelrac25.workers.dev`).
  Allowlist: api.mercadolibre.com, lista.mercadolivre.com.br, www.olx.com.br,
  www.webmotors.com.br + estáticos. **OLX testado: 200 OK 611KB de HTML real**.
- `services/proxyFetch.js` roteia OLX/Webmotors via worker quando
  `CLOUDFLARE_PROXY_URL` setado. olx.js e webmotors.js já adaptados.
- **OAuth Mercado Livre implementado** — ML mudou política em 2024 e bloqueia
  client_credentials (testado: 403). Caminho oficial: OAuth user, autoriza 1x,
  refresh 6 meses.
  - Tabela `ml_tokens` (id=1, single user)
  - `services/mlAuth.js` com `getAccessToken()` + auto-refresh
  - Rotas `/api/ml/start` (com auth), `/api/ml/status`, `/api/ml/disconnect`
  - Rota `/api/ml-callback` (sem auth — ML é quem chama)
  - Frontend: chip ML on/off no header (clica → fluxo OAuth)
- **Webmotors:** captcha PerimeterX bloqueia mesmo via Worker. Deferido.

### ⚠️ AÇÕES PENDENTES DO RAFA (pra ML funcionar em prod)
1. **Painel ML** (https://developers.mercadolivre.com.br/devcenter):
   - App 7601566341664366 → Editar → Redirect URIs
   - Adicionar: `https://garimpador-de-pecas.vercel.app/api/ml-callback`
2. **Vercel env vars** (Settings → Environment Variables):
   - `CLOUDFLARE_PROXY_URL` = `https://jolly-sky-64e9.rafaelrac25.workers.dev`
   - `CLOUDFLARE_PROXY_KEY` = `gp_a8f3e7d29c1b54f6e09b2c8d7a3f5e91`
   - `ML_CLIENT_ID` = `7601566341664366`
   - `ML_CLIENT_SECRET` = `kuXyMWw38ZcCA12RM20A3foooq4ajVor`
   - `ML_REDIRECT_URI` = `https://garimpador-de-pecas.vercel.app/api/ml-callback`
3. **Neon DB grátis** (urgente — sem isso token vira pó em cada cold start):
   - Vercel Dashboard → Storage → Connect Database → Neon → free tier
   - `DATABASE_URL` é setado automaticamente
4. **Redeploy** Vercel (push já dispara; se setar env depois, fazer Redeploy manual).

**Fluxo após Rafa configurar:**
- Abrir app → chip "ML off" → clicar → autoriza no ML → volta "ML on"
- Buscar peça → resultados ML + OLX consolidados

---

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

### Ofertas imperdíveis na home (parcialmente implementado)
Pedida pelo Rafa em 2026-05-07 — área de destaque na home com promoções e
ofertas que valem a pena.

**Backend:** ✅ pronto. `GET /api/offers/featured?modelo=C10` retorna top 12
ofertas ranqueadas por "atratividade" (foto + preço no quartil inferior +
frete grátis). Cache em memória 30min. Roda 3 buscas paralelas dos termos
mais quentes (kit motor, para-choque, caçamba) e cruza por score.

**Frontend:** PENDENTE — Fase 1+ (visual). Sugestão: carousel horizontal
mobile + grid 3 cols desktop. Cada card mostra foto, preço com %desconto
estimado vs mediana, fonte (badge ML/OLX/WM), tag "frete grátis" se houver.

**Refinos futuros:**
- Cache em DB em vez de memória (sobrevive cold start Vercel)
- Histórico de preços por anúncio: "este item caiu 20% em 3 dias" como prova
- Toggle "novo" / "usado" / "ambos" no widget

### Galeria @c14docosta na home (parcialmente implementado)
Pedida pelo Rafa em 2026-05-07. Sessão de galeria com fotos do Instagram
@c14docosta — vai dar identidade ao app (visual segue mesma estética).

**Backend:** ✅ pronto. `GET /api/galeria` em 2 modos:
- **Oficial:** se `IG_ACCESS_TOKEN` definido, busca via Instagram Graph API
  (`/me/media`). Retorna fotos+vídeos+carrosséis com caption, permalink,
  timestamp. Cache 1h.
- **Estático:** fallback se token ausente — lê `backend/src/data/galeria-static.json`.
  Bom pro MVP enquanto IG não está conectado.

**Pra ativar Graph API (caminho oficial, gratuito):**
1. App IG @c14docosta → Configurações → vira Business/Creator
2. Conectar a uma Page do FB (criar uma vazia se não tiver)
3. developers.facebook.com → criar App → solicitar permissões:
   `instagram_basic`, `pages_show_list`, `pages_read_engagement`
4. Gerar long-lived token (60 dias, refresh automático fácil)
5. Salvar como `IG_ACCESS_TOKEN` no Vercel (e local)

**Frontend:** PENDENTE — Fase visual. Sugestão: grid 3 colunas mobile,
6 desktop, lazy loading. Lightbox ao clicar. Carrossel de "destaques"
no topo da home.
