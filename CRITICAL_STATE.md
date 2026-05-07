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
