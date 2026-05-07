# Garimpador de Peças — Instruções Claude

App pessoal de busca de peças de carro antigo, foco principal **Chevrolet C10/C14**. Uso pessoal do Rafa, não público.

**Sempre responder em português do Brasil.**

---

## Triggers automáticos (no `~/CLAUDE.md` global)

Quando o Rafa disser "retomar garimpador" / "continuar garimpador" / "abrir garimpador" / "garimpador", executar:

1. `curl -s -m 15 https://<garimpador>.vercel.app/api/health` (estado vivo das integrações)
2. `cat /c/Users/Rafa/garimpador-de-pecas/CRITICAL_STATE.md` (via Bash, NÃO Read — hook claude-mem distorce)
3. `cd /c/Users/Rafa/garimpador-de-pecas && git log --oneline -10 && git status`
4. Reportar estado + bugs abertos + próximo passo

---

## Fluxo obrigatório

1. Ler `PROJECT.md` antes de qualquer tarefa
2. Identificar o módulo relevante (frontend page / backend service / etc.)
3. Abrir **apenas** os arquivos do módulo
4. Após cada mudança que toca frontend: `cd frontend && npm run build` antes do commit
5. Após cada mudança: build + commit + push → enviar link de prod
6. Atualizar `CRITICAL_STATE.md` em decisões/criações importantes (mesma regra global de checkpoints)

---

## Regras críticas

- **🔒 ISOLAMENTO TOTAL**: este projeto é EXCLUSIVO do Garimpador de Peças.
  NÃO misturar com `traffic-manager` (AdManager Cris Costa) nem com
  `cris-costa-criativos`. Vale pra:
  - Credenciais (Groq, Gemini, Meta, Neon — cada projeto tem as suas)
  - Banco de dados (não compartilhar tabelas)
  - Sessões: sessão do garimpador NÃO escreve em CRITICAL_STATE de outro projeto
  - Reuso permitido: SÓ ler estrutura/padrões dos outros projetos como
    REFERÊNCIA pra replicar metodologia (não copiar dados nem chaves).
  Veto: se qualquer ação cruzar projetos, REJECT mesmo com decisão majoritária do Council.
- **Foco C10/C14**: prompts da IA, presets de busca, switch default — tudo otimizado pra esse modelo. Não generalizar prematuramente.
- **Sem login/cadastro**: middleware token é a única auth.
- **Sem FB Marketplace**: deferido (scraping frágil sem API).
- **Tudo grátis**: não introduzir dependência paga sem checar com Rafa.
- **Mobile-first**: pensar no celular antes do desktop em toda decisão de UI.
- **Não criar tela de pagamento/cadastro/admin**: app é uso pessoal único.

---

## Convenções de código

- Comentários só pra "por que" não-óbvio. Não comentar o "o que" do código.
- Variáveis em PT-BR quando expostas pro usuário (labels, mensagens). Identificadores de código em inglês (camelCase).
- Status visuais: verde=ativo/ok, amarelo=pausa/aguardando, vermelho=erro (mesma regra do AdManager — usa `utils/statusLabels.js`).

---

## Stack rápido

- Backend Express + SQLite (dev) / PG Neon (prod)
- Frontend Vite + React 18
- IA: Groq vision (primária) + Gemini 2.0 Flash (backup)
- Deploy Vercel monorepo, `frontend/dist/` commitado

---

## Council mental (em decisões não-triviais)

Toda decisão sobre arquitetura, tom da UI, prompt da IA, escolha de fonte de busca, ou tradeoff de performance passa por Council mental (Planner, Validator, Risk Reviewer, Domain Expert: Mecânica/Carro Antigo, Auditor de Verdade). Visível em decisões críticas, oculto em pedidos triviais. Detalhes em `~/CLAUDE.md` global.
