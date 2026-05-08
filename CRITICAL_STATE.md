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

---

## ✓ CHECKPOINT — 2026-05-08 — ML VIA SCRAPER PLAYWRIGHT EM GITHUB ACTIONS (commit 8bf1097)

**Contexto:** ML continua bloqueado no Vercel datacenter; ScraperAPI free não cobre ML (Protected Domain → premium pago). Decisão: caminho 100% free + sustentável.

**Solução implementada:**
- Robô Playwright roda em runner GitHub Actions (repo público = minutos ilimitados)
- Cron a cada 2h + dispatch manual via botão no app
- 15 termos pré-definidos C10/C14 (carburador, kit motor, para-choque, caçamba, banco, farol, retrovisor, volante, emblema, friso, tanque, caixa câmbio)
- Popula tabela `ml_offers_cache` no Neon (upsert + cleanup >14 dias)
- Backend lê do cache via tokens LIKE no título; frontend mostra count + "há Xh"

**Arquivos criados/modificados:**
- `scripts/scrape-ml.js` — Playwright scraper (Chromium headless, throttle 2s/termo)
- `.github/workflows/ml-scraper.yml` — cron + manual dispatch
- `backend/src/db/schema-postgres.sql` — tabelas `ml_offers_cache` + `ml_scrape_status`
- `backend/src/services/mercadoLivre.js` — query do cache em vez de scraping live
- `backend/src/routes/admin.js` — `/scrape-ml/status` + `/scrape-ml/trigger`
- `frontend/src/App.jsx` — chip "ML · 245 ofertas · há 1h" com botão atualizar

**⚠️ AÇÕES PENDENTES DO RAFA:**
1. **GitHub Secrets** (https://github.com/rafaelrac25-crypto/garimpador-de-pecas/settings/secrets/actions):
   - `DATABASE_URL` = mesmo valor que está no Vercel
2. **PAT GitHub fine-grained** (https://github.com/settings/tokens?type=beta):
   - Repository: garimpador-de-pecas
   - Permissions: Actions Read and write
   - Copiar token gerado
3. **Vercel env** (Settings → Environment Variables):
   - `GITHUB_PAT` = token gerado no passo 2
   - Redeploy após salvar

**Validação:**
- `/api/admin/init-schema` retornou `{ok:true, applied:18}` — tabelas criadas no Neon
- Schema rodado em 2026-05-08T12:39 UTC
- Build frontend ok (240KB), commit pushed: `8bf1097`

**Custos:** ZERO. GitHub Actions repo público = unlimited; Neon free tier; Vercel free.

**Termos editáveis em:** `scripts/scrape-ml.js` linha 19+ (array `TERMOS`).

**Limites práticos:**
- Cron mínimo do GitHub: 5 min (configurado em 2h pra não saturar)
- Botão manual: ~30-45s pra completar (workflow_dispatch via API)
- Anti-bot ML: Playwright real-browser passa na maioria dos casos. Se anti-bot evoluir, plano B: rotacionar User-Agent ou usar `playwright-extra` com stealth plugin.


---

## ✓ CHECKPOINT — 2026-05-08 — ML BLOQUEADO EM IP DATACENTER, CAMINHO DEFINIDO É BOOTSTRAP MANUAL DE SESSÃO

**Diagnóstico final do bloqueio ML:**
- API oficial: 403 mesmo com OAuth (política 2024) ✗
- Cloudflare Worker: detectado como suspicious-traffic ✗
- ScraperAPI free: ML é "Protected Domain" → exige premium ($49/mês) ✗
- GitHub Actions Playwright + stealth + warmup BR: home BR carrega, mas página de listagem (search) redireciona pra "Mercado Libre" (espanhol) com login wall ✗
- DuckDuckGo HTML scraping: snippets genéricos sem preço/foto ✗
- Cloudflare Browser Rendering: Workers Paid ($5/mês mínimo) ✗
- **Política ML confirmada**: search anônimo de IP datacenter exige login. Home pública OK, busca não.

**Caminho escolhido (commit 32fac20):**
- Conta ML descartável criada pelo Rafa (NÃO usar conta pessoal — risco de ban)
- Script `scripts/bootstrap-ml-session.js`: roda 1x no PC do Rafa em modo headed, ele loga manual (IP residencial Joinville aceita), salva storage_state em `ml_session` (single-row, id=1)
- GitHub Actions cron horário reusa a sessão. Se ML invalidar (mudar de IP datacenter), Rafa refaz bootstrap manualmente

**Arquitetura do scraper atual:**
- 1 termo por run (não 15) — anti-bot ML detecta padrão de buscas seguidas
- Cron horário (`17 * * * *`)  → 24 termos cobertos por dia em rotação
- workflow_dispatch aceita inputs `termo`/`modelo` pra busca on-demand
- Tabela `ml_terms_learned`: cada miss do user adiciona termo à rotação
- Stealth plugin + cookies BR + UA randomizado + warmup com home

**Estado das infra:**
- Schema atual: 27 statements aplicados no Neon (inclui `ml_offers_cache`, `ml_scrape_status`, `ml_terms_learned`, `ml_session`)
- Cache atual: 30 anúncios (do run que pegou 1 termo de OLX antes do bloqueio total)
- OLX continua 100% funcional — não dependente desse caminho ML
- Frontend chip "ML · 30 ofertas · há Xh" + botão atualizar manual (precisa GITHUB_PAT no Vercel pra disparar)

**⚠️ O QUE FALTA — AÇÃO DO RAFA (próxima sessão):**

1. **Bootstrap manual da sessão ML** (caminho documentado em /CRITICAL_STATE):
   - Instalar Node 20+ no Windows (se ainda não tem)
   - `git pull`
   - Pegar DATABASE_URL do Neon (https://console.neon.tech → projeto neon-aqua-flower → Connect)
   - Criar `scripts/.env` com `DATABASE_URL=postgresql://...`
   - `cd scripts && npm install playwright @neondatabase/serverless dotenv`
   - `npx playwright install chromium`
   - `node bootstrap-ml-session.js` → janela abre, Rafa loga manual, espera "✅ Sessão salva!"

2. **Rodar workflow** após bootstrap: github.com/rafaelrac25-crypto/garimpador-de-pecas/actions/workflows/ml-scraper.yml → Run workflow

3. **Validar resultado**: se sessão for aceita pelo ML mesmo de IP datacenter, ML passa a popular cache. Se ML invalidar a sessão (rejeição vinda de IP novo), pivotamos pra plano A (só OLX).

4. **Pendentes menores (depois do ML estabilizar):**
   - Criar PAT GitHub fine-grained (scope Actions Read/Write) + setar `GITHUB_PAT` no Vercel → habilita botão "Atualizar agora" do app
   - Configurar Task Scheduler nos PCs Rafa+irmão pra scraping local complementar (opcional, IP residencial = robusto)
   - Alerta de quota: notificar quando atingir N buscas/dia (regra que Rafa pediu)

5. **Pendências do projeto antes do ML:**
   - Galeria @c14docosta na home (precisa IG_ACCESS_TOKEN)
   - Carrossel rico de ofertas em destaque
   - PWA (manifest + ícone)
   - Filtro generalizado pra outros modelos

**Secrets configurados:**
- GitHub: `DATABASE_URL` ✓, `ML_USER` ✓, `ML_PASSWORD` ✓
- Vercel: DATABASE_URL ✓, SCRAPERAPI_KEY ✓ (inerte — free não cobre ML)
- Falta no Vercel: `GITHUB_PAT` (pra botão manual do app)

**Conta ML descartável:** Rafa criou em 2026-05-08, email separado, sem 2FA.

**Custos:** ZERO (GitHub Actions repo público unlimited, Neon free, Vercel free, ScraperAPI free).

