# Orbis Chat — Design (2026-09-04)

Chat multi-sessão no portal para conversar com o Hermes Agent e operar o CRM
pela conversa (direção ② da integração Hermes). O agente executa ações via as
tools MCP que o próprio Orbis já expõe (direção ①).

Decisões aprovadas: chats livres estilo ChatGPT (criar/nomear/alternar);
superfícies widget flutuante + página dedicada `/chat`; transporte por poll
(adapter pergunta, Orbis responde — Seção 1); assíncrono por construção.

## Transporte e contrato

O Orbis nunca empurra nada para o Hermes. Todo o fluxo nasce de poll:

1. UI posta mensagem do usuário → gravada `pending`, confirma na hora.
2. Adapter Hermes (poll ~5s, Bearer `orbis_*`) recolhe em `GET /api/chat/outbox`.
3. Adapter entrega ao gateway via `handle_message`; o agente opera via MCP.
4. `send()` do adapter posta a resposta em `POST /api/chat/inbox`.
5. UI (poll 2,5s com chat aberto, pausado com aba oculta) exibe.

Anti-duplicidade: a outbox flipa `pending → claimed` com
`UPDATE … WHERE estado='pending'` — atômico, só um gateway recolhe cada
mensagem. Claim órfão (adapter morreu no meio): volta a ser recolhível após
10 minutos (`claimed_at`).

## Banco — migration `0007_chat.sql`

```sql
CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_chat_sessions_user ON chat_sessions(user_id);

CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  remetente TEXT NOT NULL CHECK (remetente IN ('user','agent')),
  texto TEXT NOT NULL CHECK (length(texto) BETWEEN 1 AND 8000),
  estado TEXT NOT NULL DEFAULT 'pending'
    CHECK (estado IN ('pending','claimed','delivered','error')),
  claimed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id, created_at);
CREATE INDEX idx_chat_messages_pending ON chat_messages(estado, claimed_at);
```

Só mensagem de `user` transita `pending → claimed → delivered`; resposta do
agente já nasce `delivered`. Excluir sessão apaga as mensagens (CASCADE).

## API — `src/routes/chat.ts`, montado em `/api/chat`

Padrões do repo: `zod schema.parse` no POST/PATCH, `requireAuth` por cookie
na UI, `verifyBearer` no adapter, ids `cht_` (sessões) / `chm_` (mensagens), erros `{ error, code, requestId }`, PT-BR na UI.

UI (cookie de sessão):

- `GET /api/chat/sessions` → `[{ id, titulo, updated_at }]` do usuário.
- `POST /api/chat/sessions` `{ titulo? }` → 201; default `Chat <dd/mm hh:mm>`.
- `PATCH /api/chat/sessions/:id` `{ titulo }` → renomeia; 404 se de outro.
- `DELETE /api/chat/sessions/:id` → apaga (CASCADE); 404 se de outro.
- `GET /api/chat/sessions/:id/messages` → mensagens em ordem; 404 se de outro.
- `POST /api/chat/sessions/:id/messages` `{ texto }` (1–8000 chars) → 201,
  grava `user`/`pending`; 404 se a sessão é de outro usuário.

Adapter (só `Authorization: Bearer`, cookie nunca autentica `/api/chat/outbox`
nem `/api/chat/inbox`):

- `GET /api/chat/outbox` → `pending` (ou `claimed` há +10min) **só das sessões
  do dono do token**, flipando para `claimed` + `claimed_at`. Vazio → `[]`.
- `POST /api/chat/inbox` `{ session_id, texto, reply_to? }` → insere
  `agent`/`delivered`; 404 se a sessão não é do dono do token.

## UI — widget + página

- **Widget** (`frontend/src/components/ChatWidget.tsx`): botão fixo
  bottom-right, acima da tab bar no mobile; painel ~380px, overlay full-screen
  no mobile. Seletor de sessão no topo, mensagens, input. Montado no `App.tsx`
  em todas as rotas exceto `/login` e `/chat`. Tokens existentes
  (`bg-paper/text-ink/bg-brand/border-line`); respiro só com padding, sem
  cards aninhados.
- **Página `/chat`** (`frontend/src/pages/Chat.tsx`): entra no switch de
  `pathname`; lista de sessões (sidebar desktop, seletor mobile) + conversa;
  criar/renomear/excluir.
- **Estados da mensagem**: `pending` ("aguardando agente"), `delivered`,
  `error` com "tentar de novo" (reverte para `pending`, não duplica).

## Erros, auditoria, limites

- Adapter fora do ar: tudo aguarda em `pending`; UI mostra "aguardando
  agente". Volta sozinho, sem ação do usuário.
- Falha do agente: adapter posta na inbox com `estado=error`; UI mostra texto
  amigável PT-BR, nunca stack trace nem JSON-RPC cru.
- Auditoria via `audit()`: `chat_message` (UI envia), `chat_claim` (adapter
  recolhe), `chat_reply` (adapter responde); actor = usuário dono da sessão
  (na UI) ou do token (no adapter).
- Limites v1: texto 8000 chars; sem anexos/imagens; sem markdown rico além do
  que o chat já renderizar como texto; sem streaming token-a-token.

## Testes

Backend TDD no padrão do repo (`app.request()`, sem servidor vivo):
cookie sem sessão → 401; Bearer inválido/revogado na outbox/inbox → 401;
sessão de outro usuário → 404 nas seis rotas UI + inbox; dois polls
seguidos — só o primeiro recolhe (flip atômico); `POST` mensagem >8000 →
400; resposta do agente aparece no `GET messages`. Frontend: widget render +
poll pausado com aba oculta (jsdom).

## Fora do escopo v1

Webhooks Orbis→Hermes, websocket/SSE, anexos, streaming, `cron_deliver_env`
cutucando via Orbis, `platform_hint`, excluir mensagens avulsas, busca no
histórico.

## Apêndice — plugin Hermes (fora deste repo, contrato)

`~/.hermes/plugins/orbis/plugin.yaml` (`kind: platform`,
`requires_env: [ORBIS_URL, ORBIS_TOKEN]`) + `adapter.py` com
`ctx.register_platform(name="orbis", adapter_factory=…,
check_fn, validate_config, max_message_length=4000,
platform_hint="Você está falando via Orbis…")`. `send()` → POST inbox;
poll outbox → `handle_message(event)`. Config Hermes:

```yaml
mcp_servers:
  orbis:
    url: "https://orbis-portal-staging.orbis-d36.workers.dev/mcp"
    headers: { Authorization: "Bearer ${env:ORBIS_MCP_TOKEN}" }
    skip_preflight: true
    tools: { include: [search_processos, get_processo, search_clientes,
      get_cliente, list_prazos, list_tarefas, get_dashboard,
      create_prazo, update_prazo_status, create_tarefa, update_tarefa,
      create_processo, update_processo, create_cliente, update_cliente],
      resources: false, prompts: false }
```

(`delete_cliente` fora do include inicial por segurança; entra quando o dono
pedir.)
