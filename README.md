# Garimpador de Peças

App pessoal pra buscar peças de carro antigo (foco em **Chevrolet C10/C14**) agregando Mercado Livre, OLX e Web Motor + reconhecimento de imagem com IA.

> Uso pessoal único. Acesso restrito por token na URL.

## Rodar local

```bash
# Backend (porta 3001)
cd backend
npm install
cp .env.example .env  # editar com seus valores
npm run dev

# Frontend (porta 5173)
cd frontend
npm install
npm run dev
```

Abrir: `http://localhost:5173/?key=<seu ACCESS_KEY do .env>`

## Estrutura

Detalhes em [`PROJECT.md`](./PROJECT.md). Estado vivo entre sessões em [`CRITICAL_STATE.md`](./CRITICAL_STATE.md).

## Deploy

Push pra `main` → Vercel deploya automaticamente. Config em `vercel.json`.

## Stack

- React + Vite (frontend)
- Express + SQLite/Postgres (backend)
- Groq vision (IA reconhecimento de imagem)
- Vercel (free tier)
