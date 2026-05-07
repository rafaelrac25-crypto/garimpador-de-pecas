# Garimpador de Peças

App pessoal pra **buscar peças de carro antigo** agregando múltiplas fontes brasileiras (Mercado Livre, OLX, Web Motor) + reconhecimento de imagem com IA gratuita.

**Foco principal:** Chevrolet **C10** e **C14** (caminhonetes clássicas anos 60-80). App é genérico mas otimizado pra esse caso.

**Uso:** estritamente pessoal (Rafa). Não é aberto ao público — acesso via token na URL.

---

## Stack

- **Backend:** Node.js + Express + SQLite (dev) / PostgreSQL Neon (prod)
- **Frontend:** React + Vite + CSS vars (mobile-first com layout desktop ≥1024px)
- **Deploy:** Vercel (free tier, monorepo)
- **IA:** Groq `llama-4-scout` (vision multimodal). Backup: Gemini 2.0 Flash
- **Auth:** token na URL (`?key=...`) → header `X-Access-Key`

---

## Fontes de busca (MVP)

| Fonte | Método | Status |
|---|---|---|
| Mercado Livre | API pública `api.mercadolibre.com` | 🟢 estável |
| OLX | Scraping HTML com `cheerio` | 🟡 frágil (HTML pode mudar) |
| Web Motor | Scraping (cheerio/Playwright) | 🟡 frágil (é SPA) |
| ~~Marketplace FB~~ | — | ❌ fora do MVP (sem API) |

---

## Regras de negócio

- **Foco em C10/C14**: switch de modelo no topo da busca (default C10), prompts da IA contextualizados, dataset de peças comuns curado.
- **Sempre PT-BR** nas respostas e UI.
- **Mobile-first**: layout default ≤480px; desktop ativa em ≥1024px.
- **Sem cadastro/login**: token na URL é a única autenticação.
- **Tudo gratuito**: nada de pagamento — usa só free tiers (Vercel, Neon, Groq, Gemini).

---

## Funcionalidades planejadas

- Busca por texto com filtros (preço, condição, estado, modelo)
- Resultados consolidados de múltiplas fontes (dedup por título+preço)
- Busca por foto: IA identifica peça → executa busca textual
- Favoritar peças
- Histórico de buscas
- Alerta de queda de preço (cron diário compara preço de favoritos)

---

## Estrutura de pastas

```
garimpador-de-pecas/
├── backend/src/
│   ├── index.js
│   ├── db/, middleware/, routes/, services/
└── frontend/src/
    ├── App.jsx, main.jsx, index.css
    ├── pages/, components/, contexts/, services/, utils/, data/
```

Detalhes em `PROJECT_MAP.md` (criado quando o projeto crescer).

---

## Variáveis de ambiente

Ver `.env.example`. Resumo:
- `ACCESS_KEY` — token de acesso (32 bytes hex)
- `GROQ_API_KEY` — IA primária (vision)
- `GEMINI_API_KEY` — IA backup (opcional)
- `DATABASE_URL` — Neon Postgres (vazio = SQLite local)
- `CRON_SECRET` — auth do cron Vercel

---

## Deploy

- **Repo:** (a criar) `github.com/rafaelrac25-crypto/garimpador-de-pecas`
- **URL prod:** (a definir) `garimpador.vercel.app` ou similar
- **Cache:** backend força `Cache-Control: no-store` no `index.html` (mesmo padrão do AdManager)

## Como rodar local

```bash
# Backend
cd backend && npm install && npm run dev   # porta 3001

# Frontend
cd frontend && npm install && npm run dev  # porta 5173

# Acessar:
# http://localhost:5173/?key=<seu ACCESS_KEY>
```
