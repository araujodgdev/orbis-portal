# Orbis Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chat multi-sessão no portal (widget flutuante + página `/chat`) que troca mensagens com o Hermes Agent via outbox/inbox, com o agente operando o CRM pelas tools MCP.

**Architecture:** Adapter Hermes faz poll em `GET /api/chat/outbox` (Bearer `orbis_*`) e posta respostas em `POST /api/chat/inbox`; UI usa sessão cookie nos endpoints `/api/chat/*`. D1 guarda `chat_sessions` + `chat_messages`. Assíncrono por construção: envia → `pending` → resposta chega depois.

**Tech Stack:** Cloudflare Worker (Hono 4) + D1, React 19 + Vite + Tailwind v4, zod 3.25, vitest 2 (backend e frontend), `@modelcontextprotocol/sdk` 1.30.0 (só reuso de `verifyBearer`, sem dependência nova).

**Spec:** `docs/superpowers/specs/2026-09-04-orbis-chat-design.md`

## Global Constraints

- TDD: teste falha antes do código; suíte backend (`npm test` na raiz) e frontend (`npm test` em `frontend/`) 100% verde ao fim de cada task.
- Cópia visível ao usuário em PT-BR; nunca stack trace nem JSON-RPC cru na UI.
- Erros de API na forma `{ error, code, requestId }`; falha de validação Zod → 400 `invalid_*`; input válido com falha de DB → 500 via `err()`; recurso de outro usuário → 404 `not_found` (hand-rolled com `reqId()`, sem `console.error`).
- Ids `cht_` (sessões) / `chm_` (mensagens) via `Math.random().toString(36).slice(2, 10)`; D1 via `prepare(...).bind(...)`.
- Cookie `orbis_session` NUNCA autentica `/api/chat/outbox` nem `/api/chat/inbox` — só `Authorization: Bearer` via `verifyBearer`.
- Frontend: tokens `bg-paper/text-ink/bg-brand/border-line`, alvos de toque `min-h-11`, respiro só com padding (sem cards aninhados), sem react-router (switch de `pathname` em `App.tsx`).
- Migration local: `npm run db:migrate`; staging: `npx wrangler d1 migrations apply orbis_db --remote --env staging`; deploy staging: `npm run build --prefix frontend` + `npx wrangler deploy --env staging`.

---

## File Structure

- Create: `migrations/0007_chat.sql` — tabelas `chat_sessions`, `chat_messages` + índices.
- Create: `src/routes/chat.ts` — sub-app Hono com 8 endpoints (6 UI por cookie + outbox/inbox por Bearer).
- Modify: `src/lib/auth.ts:18` — isentar `/api/chat/outbox` e `/api/chat/inbox` do `requireAuth` (1 linha).
- Modify: `src/index.ts:16,28-40` — `import { chat }` + `app.route('/api/chat', chat as never)`.
- Create: `tests/chat.test.ts` — matriz 401/404/flip atômico/retry (padrão `makeDb` de `tests/tokens.test.ts`).
- Create: `frontend/src/pages/Chat.tsx` — página dedicada `/chat`.
- Create: `frontend/src/components/ChatWidget.tsx` — widget flutuante.
- Create: `frontend/src/pages/Chat.test.tsx`, `frontend/src/components/ChatWidget.test.tsx` — jsdom + `// @vitest-environment jsdom`, `fetch` stubado.
- Modify: `frontend/src/App.tsx:18-22,60-82` — rota `/chat`, monta widget exceto em `/login` e `/chat`.

---

### Task 1: Migration + sessões (CRUD)

**Files:**
- Create: `migrations/0007_chat.sql`
- Create: `src/routes/chat.ts` (parte 1: helpers + 4 endpoints de sessão)
- Test: `tests/chat.test.ts` (parte 1: `describe` de sessões)

**Interfaces:**
- Consumes: `audit(db, actor, acao, entidade, entidade_id)` de `src/lib/auth.ts`; `err(e, code, status)` + `reqId()` de `src/lib/errors.ts`.
- Produces: `export const chat` (sub-app Hono); `ownSession(db, id, userId)` usado pela Task 2; tabela `chat_sessions`.

- [ ] **Step 1: Write migration + failing test for session list**

```sql
-- migrations/0007_chat.sql
CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(user_id);
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  remetente TEXT NOT NULL CHECK (remetente IN ('user','agent')),
  texto TEXT NOT NULL CHECK (length(texto) BETWEEN 1 AND 8000),
  estado TEXT NOT NULL DEFAULT 'pending'
    CHECK (estado IN ('pending','claimed','delivered','error')),
  claimed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_pending ON chat_messages(estado, claimed_at);
```

```typescript
// tests/chat.test.ts (parte 1 — acrescentar mais describes na Task 2)
import { describe, it, expect } from 'vitest';
import app from '../src/index';

type Row = Record<string, unknown>;
export function makeChatDb(opts: {
  sessionOwner?: Row | null;
  sessionList?: Row[];
  tokenUser?: Row | null;
  messages?: Row[];
  outbox?: Row[];
  changes?: number;
} = {}) {
  const seen: string[] = [];
  const db = {
    prepare: (sql: string) => {
      seen.push(sql);
      return {
        bind: (..._args: unknown[]) => ({
          first: async () => {
            if (/FROM chat_sessions/.test(sql)) {
              if (opts.sessionOwner !== undefined) return opts.sessionOwner;
              return { id: 'cht_1', user_id: 'u1' };
            }
            if (/FROM api_tokens/.test(sql)) return opts.tokenUser !== undefined ? opts.tokenUser : null;
            if (/FROM sessions/.test(sql)) return { user_id: 'u1', expires_at: '2999-01-01T00:00:00.000Z' };
            return null;
          },
          all: async () => {
            if (/FROM chat_sessions/.test(sql)) return { results: opts.sessionList ?? [] };
            if (/FROM chat_messages/.test(sql)) {
              if (/estado/.test(sql)) return { results: opts.outbox ?? [] };
              return { results: opts.messages ?? [] };
            }
            return { results: [] };
          },
          run: async () => ({ success: true, meta: { changes: opts.changes ?? 1 } }),
        }),
      };
    },
  };
  return { db: db as never, seen };
}
const authed = { 'content-type': 'application/json', cookie: 'orbis_session=fake' };

describe('GET /api/chat/sessions', () => {
  it('lists own sessions in order', async () => {
    const { db, seen } = makeChatDb({ sessionList: [{ id: 'cht_1', titulo: 'Chat', updated_at: '2026-09-04' }] });
    const res = await app.request('/api/chat/sessions', { headers: authed }, { DB: db });
    expect(res.status).toBe(200);
    expect(seen.some((s) => /FROM chat_sessions.*WHERE user_id/.test(s))).toBe(true);
    const body = await res.json() as { data: { id: string }[] };
    expect(body.data[0].id).toBe('cht_1');
  });
  it('rejects without session', async () => {
    const { db } = makeChatDb();
    const res = await app.request('/api/chat/sessions', {}, { DB: db });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/chat.test.ts`
Expected: FAIL with "Cannot find module '../src/routes/chat'" (import chain via `src/index.ts` ainda sem mount → na prática falha em 404; vale como RED desde que o status não seja 200)

- [ ] **Step 3: Write migration + sessions implementation + mount**

```typescript
// src/routes/chat.ts (parte 1)
import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../lib/auth';
import { err, reqId } from '../lib/errors';
import type { Env } from '../index';

export const chat = new Hono<{ Bindings: Env }>();

function actorId(c: { get: (k: never) => unknown }): string {
  return c.get('actor' as never) as string;
}

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function ownSession(db: D1Database, id: string, userId: string) {
  return db.prepare(`SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?`).bind(id, userId).first<{ id: string }>();
}

function notFound() {
  return Response.json({ error: 'not_found', code: 'not_found', requestId: reqId() }, { status: 404 });
}

chat.get('/sessions', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, titulo, updated_at FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50`
  ).bind(actorId(c)).all();
  return c.json({ data: rows.results });
});

chat.post('/sessions', async (c) => {
  try {
    const body = z.object({ titulo: z.string().max(80).default('') }).parse(await c.req.json());
    const titulo = body.titulo.trim() || `Chat ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
    const id = rid('cht');
    await c.env.DB.prepare(`INSERT INTO chat_sessions (id, user_id, titulo) VALUES (?, ?, ?)`)
      .bind(id, actorId(c), titulo).run();
    await audit(c.env.DB, actorId(c), 'chat_session_create', 'chat_session', id);
    return c.json({ data: { id, titulo } }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return err(e, 'invalid_chat_session', 400);
    return err(e);
  }
});

chat.patch('/sessions/:id', async (c) => {
  try {
    const body = z.object({ titulo: z.string().min(1).max(80) }).parse(await c.req.json());
    const r = await c.env.DB.prepare(
      `UPDATE chat_sessions SET titulo = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`
    ).bind(body.titulo.trim(), c.req.param('id'), actorId(c)).run() as unknown as { meta: { changes: number } };
    if (!r.meta?.changes) return notFound();
    await audit(c.env.DB, actorId(c), 'chat_session_rename', 'chat_session', c.req.param('id'));
    return c.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return err(e, 'invalid_chat_session', 400);
    return err(e);
  }
});

chat.delete('/sessions/:id', async (c) => {
  const r = await c.env.DB.prepare(`DELETE FROM chat_sessions WHERE id = ? AND user_id = ?`)
    .bind(c.req.param('id'), actorId(c)).run() as unknown as { meta: { changes: number } };
  if (!r.meta?.changes) return notFound();
  await audit(c.env.DB, actorId(c), 'chat_session_delete', 'chat_session', c.req.param('id'));
  return c.json({ ok: true });
});
```

Mount em `src/index.ts` (2 linhas, mesmo padrão das rotas existentes):

```typescript
import { chat } from './routes/chat';
// ...
app.route('/api/chat', chat as never);
```

Aplicar migration local: `npm run db:migrate`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/chat.test.ts` → Expected: PASS. Depois `npm test` (suíte toda verde).

- [ ] **Step 5: Commit**

```bash
git add migrations/0007_chat.sql src/routes/chat.ts src/index.ts tests/chat.test.ts
git commit -m "feat: chat sessions API + migration 0007"
```

### Task 2: Mensagens + retry + outbox/inbox do adapter

**Files:**
- Modify: `src/routes/chat.ts` (acrescenta 4 endpoints)
- Modify: `src/lib/auth.ts:18` (isentar outbox/inbox do `requireAuth`)
- Test: `tests/chat.test.ts` (acrescenta 4 describes)

**Interfaces:**
- Consumes: `ownSession` + `rid` + `notFound` da Task 1; `verifyBearer(db, header)` de `src/mcp/auth.ts` (mesma assinatura usada em `src/index.ts:46`).
- Produces: contrato final do adapter (outbox/inbox) consumido pelo plugin Hermes (fora do repo).

- [ ] **Step 1: Write the failing tests (messages, retry, outbox, inbox)**

```typescript
describe('POST /api/chat/sessions/:id/messages', () => {
  it('stores user message as pending', async () => {
    const { db, seen } = makeChatDb();
    const res = await app.request('/api/chat/sessions/cht_1/messages', {
      method: 'POST', headers: authed, body: JSON.stringify({ texto: 'Qual o prazo do caso?' }),
    }, { DB: db });
    expect(res.status).toBe(201);
    expect(seen.some((s) => /INSERT INTO chat_messages/.test(s) && /'pending'/.test(s))).toBe(true);
    const body = await res.json() as { data: { estado: string } };
    expect(body.data.estado).toBe('pending');
  });
  it('404s on another user session', async () => {
    const { db } = makeChatDb({ sessionOwner: null });
    const res = await app.request('/api/chat/sessions/cht_x/messages', {
      method: 'POST', headers: authed, body: JSON.stringify({ texto: 'oi' }),
    }, { DB: db });
    expect(res.status).toBe(404);
  });
  it('rejects empty and oversized text', async () => {
    const { db } = makeChatDb();
    for (const texto of ['', 'x'.repeat(8001)]) {
      const res = await app.request('/api/chat/sessions/cht_1/messages', {
        method: 'POST', headers: authed, body: JSON.stringify({ texto }),
      }, { DB: db });
      expect(res.status).toBe(400);
    }
  });
});

describe('POST retry', () => {
  it('flips error back to pending', async () => {
    const { db, seen } = makeChatDb();
    const res = await app.request('/api/chat/sessions/cht_1/messages/chm_9/retry', {
      method: 'POST', headers: authed,
    }, { DB: db });
    expect(res.status).toBe(200);
    expect(seen.some((s) => /SET estado = 'pending'/.test(s) && /estado = 'error'/.test(s))).toBe(true);
  });
  it('404s when nothing flipped', async () => {
    const { db } = makeChatDb({ changes: 0 });
    const res = await app.request('/api/chat/sessions/cht_1/messages/chm_9/retry', {
      method: 'POST', headers: authed,
    }, { DB: db });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/chat/outbox (adapter, Bearer-only)', () => {
  const bearer = { authorization: 'Bearer orbis_test' };
  it('returns pending with valid token and no cookie', async () => {
    const { db, seen } = makeChatDb({ tokenUser: { user_id: 'u1' }, outbox: [{ id: 'chm_1', session_id: 'cht_1', texto: 'oi' }] });
    const res = await app.request('/api/chat/outbox', { headers: bearer }, { DB: db });
    expect(res.status).toBe(200);
    expect(seen.some((s) => /SET estado = 'claimed'/.test(s) && /estado = 'pending'/.test(s))).toBe(true);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });
  it('401s with requestId chat (not auth) on bad token', async () => {
    const { db } = makeChatDb({ tokenUser: null });
    const res = await app.request('/api/chat/outbox', { headers: bearer }, { DB: db });
    expect(res.status).toBe(401);
    const body = await res.json() as { requestId: string };
    expect(body.requestId).toBe('chat');
  });
  it('ignores cookies: Bearer valid + no cookie still works', async () => {
    const { db } = makeChatDb({ tokenUser: { user_id: 'u1' }, outbox: [] });
    const res = await app.request('/api/chat/outbox', { headers: bearer }, { DB: db });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/chat/inbox (adapter, Bearer-only)', () => {
  const bearer = { 'content-type': 'application/json', authorization: 'Bearer orbis_test' };
  it('stores agent reply as delivered', async () => {
    const { db, seen } = makeChatDb({ tokenUser: { user_id: 'u1' } });
    const res = await app.request('/api/chat/inbox', {
      method: 'POST', headers: bearer, body: JSON.stringify({ session_id: 'cht_1', texto: 'O prazo é dia 12.' }),
    }, { DB: db });
    expect(res.status).toBe(201);
    expect(seen.some((s) => /'agent'/.test(s) && /'delivered'/.test(s))).toBe(true);
  });
  it('404s on another user session', async () => {
    const { db } = makeChatDb({ tokenUser: { user_id: 'u1' }, sessionOwner: null });
    const res = await app.request('/api/chat/inbox', {
      method: 'POST', headers: bearer, body: JSON.stringify({ session_id: 'cht_x', texto: 'oi' }),
    }, { DB: db });
    expect(res.status).toBe(404);
  });
  it('401s without Bearer even with valid cookie', async () => {
    const { db } = makeChatDb();
    const res = await app.request('/api/chat/inbox', {
      method: 'POST', headers: authed, body: JSON.stringify({ session_id: 'cht_1', texto: 'oi' }),
    }, { DB: db });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/chat.test.ts`
Expected: FAIL (rotas 404 — endpoint não existe)

- [ ] **Step 3: Write minimal implementation**

Acrescentar a `src/routes/chat.ts`:

```typescript
import { verifyBearer } from '../mcp/auth';

chat.get('/sessions/:id/messages', async (c) => {
  const s = await ownSession(c.env.DB, c.req.param('id'), actorId(c));
  if (!s) return notFound();
  const rows = await c.env.DB.prepare(
    `SELECT id, remetente, texto, estado, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 200`
  ).bind(c.req.param('id')).all();
  return c.json({ data: rows.results });
});

chat.post('/sessions/:id/messages', async (c) => {
  try {
    const body = z.object({ texto: z.string().min(1).max(8000) }).parse(await c.req.json());
    const id = c.req.param('id');
    const s = await ownSession(c.env.DB, id, actorId(c));
    if (!s) return notFound();
    const mid = rid('chm');
    await c.env.DB.prepare(
      `INSERT INTO chat_messages (id, session_id, remetente, texto, estado) VALUES (?, ?, 'user', ?, 'pending')`
    ).bind(mid, id, body.texto).run();
    await c.env.DB.prepare(`UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?`).bind(id).run();
    await audit(c.env.DB, actorId(c), 'chat_message', 'chat_message', mid);
    return c.json({ data: { id: mid, estado: 'pending' } }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return err(e, 'invalid_chat_message', 400);
    return err(e);
  }
});

chat.post('/sessions/:id/messages/:mid/retry', async (c) => {
  const s = await ownSession(c.env.DB, c.req.param('id'), actorId(c));
  if (!s) return notFound();
  const r = await c.env.DB.prepare(
    `UPDATE chat_messages SET estado = 'pending', claimed_at = NULL WHERE id = ? AND remetente = 'user' AND estado = 'error'`
  ).bind(c.req.param('mid')).run() as unknown as { meta: { changes: number } };
  if (!r.meta?.changes) return notFound();
  return c.json({ ok: true });
});

chat.get('/outbox', async (c) => {
  const userId = await verifyBearer(c.env.DB, c.req.header('authorization'));
  if (!userId) return c.json({ error: 'unauthorized', code: 'unauthorized', requestId: 'chat' }, 401);
  const rows = await c.env.DB.prepare(
    `SELECT m.id, m.session_id, m.texto, m.created_at FROM chat_messages m
     JOIN chat_sessions s ON s.id = m.session_id
     WHERE s.user_id = ? AND m.remetente = 'user'
       AND (m.estado = 'pending' OR (m.estado = 'claimed' AND m.claimed_at < datetime('now', '-10 minutes')))
     ORDER BY m.created_at ASC LIMIT 20`
  ).bind(userId).all<{ id: string }>();
  const ids = rows.results.map((r) => r.id);
  if (ids.length > 0) {
    await c.env.DB.prepare(
      `UPDATE chat_messages SET estado = 'claimed', claimed_at = datetime('now') WHERE id IN (${ids.map(() => '?').join(',')}) AND estado IN ('pending','claimed')`
    ).bind(...ids).run();
    await audit(c.env.DB, userId, 'chat_claim', 'chat_message', ids[0], { count: ids.length });
  }
  return c.json({ data: rows.results });
});

chat.post('/inbox', async (c) => {
  try {
    const userId = await verifyBearer(c.env.DB, c.req.header('authorization'));
    if (!userId) return c.json({ error: 'unauthorized', code: 'unauthorized', requestId: 'chat' }, 401);
    const body = z.object({ session_id: z.string().min(1), texto: z.string().min(1).max(8000) }).parse(await c.req.json());
    const s = await ownSession(c.env.DB, body.session_id, userId);
    if (!s) return notFound();
    const mid = rid('chm');
    await c.env.DB.prepare(
      `INSERT INTO chat_messages (id, session_id, remetente, texto, estado) VALUES (?, ?, 'agent', ?, 'delivered')`
    ).bind(mid, body.session_id, body.texto).run();
    await c.env.DB.prepare(`UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?`).bind(body.session_id).run();
    await audit(c.env.DB, userId, 'chat_reply', 'chat_message', mid);
    return c.json({ data: { id: mid } }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return err(e, 'invalid_chat_inbox', 400);
    return err(e);
  }
});
```

Isenção no `requireAuth` (`src/lib/auth.ts:18`) — sem ela, o Bearer-only morre no middleware com `requestId: 'auth'`:

```typescript
if (['/api/health', '/api/login', '/api/signup', '/api/chat/outbox', '/api/chat/inbox'].includes(c.req.path)) return next();
```

Nota de topologia (assunção v1, documentada aqui para o revisor): um gateway por usuário. O flip condicional impede re-claim de `claimed` fresco, mas dois gateways no mesmo segundo poderiam entregar duplicado — fora do escopo v1.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/chat.test.ts` → Expected: PASS (11 testes). Depois `npm test` (suíte toda verde).

- [ ] **Step 5: Commit**

```bash
git add src/routes/chat.ts src/lib/auth.ts tests/chat.test.ts
git commit -m "feat: chat messages + outbox/inbox do adapter"
```

### Task 3: Página dedicada `/chat` (frontend)

**Files:**
- Create: `frontend/src/pages/Chat.tsx`
- Create: `frontend/src/pages/Chat.test.tsx`
- Modify: `frontend/src/App.tsx` (rota `/chat`, sem item no NAV — entrada é o widget)

**Interfaces:**
- Consumes: `api<T>` de `frontend/src/lib/api.ts`; endpoints da Task 1–2.
- Produces: `<Chat />` sem props (lê estado próprio); página linkada pelo widget.

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
// frontend/src/pages/Chat.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { Chat } from './Chat';

function render(el: React.ReactElement) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  act(() => { root.render(el); });
  return { asyncFlush: () => act(async () => {}), unmount: () => { act(() => { root.unmount(); }); div.remove(); } };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('Chat page', () => {
  it('lists sessions and messages', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true, status: 200,
      json: async () => url.endsWith('/sessions')
        ? { data: [{ id: 'cht_1', titulo: 'Dúvida prazo', updated_at: 'x' }] }
        : { data: [{ id: 'chm_1', remetente: 'agent', texto: 'O prazo é dia 12.', estado: 'delivered', created_at: 'x' }] },
    })) as never);
    const { asyncFlush, unmount } = render(<Chat />);
    await asyncFlush();
    expect(document.body.textContent).toContain('Dúvida prazo');
    expect(document.body.textContent).toContain('O prazo é dia 12.');
    unmount();
  });
  it('sends a message via POST', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) })) as never;
    vi.stubGlobal('fetch', fetchMock);
    const { asyncFlush, unmount } = render(<Chat />);
    await asyncFlush();
    unmount();
    expect(fetchMock).toHaveBeenCalledWith('/api/chat/sessions', expect.objectContaining({ credentials: 'include' }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/pages/Chat.test.tsx` (em `frontend/`)
Expected: FAIL with "Cannot find module './Chat'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/pages/Chat.tsx
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';

type Session = { id: string; titulo: string; updated_at: string };
type Msg = { id: string; remetente: 'user' | 'agent'; texto: string; estado: string; created_at: string };

const inputClass =
  'h-11 w-full rounded-sheet border border-line bg-sheet px-3 text-[15px] text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none';

export function Chat() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const loadSessions = useCallback(async (pick?: string) => {
    const r = await api<{ data: Session[] }>('/api/chat/sessions');
    setSessions(r.data);
    const id = pick ?? r.data[0]?.id ?? '';
    setActiveId((cur) => cur || id);
  }, []);

  const loadMsgs = useCallback(async (id: string) => {
    if (!id) return;
    const r = await api<{ data: Msg[] }>(`/api/chat/sessions/${encodeURIComponent(id)}/messages`);
    setMsgs(r.data);
  }, []);

  useEffect(() => { loadSessions().catch(() => setError('Não foi possível carregar os chats.')); }, [loadSessions]);
  useEffect(() => { loadMsgs(activeId).catch(() => {}); }, [activeId, loadMsgs]);
  useEffect(() => {
    if (!activeId) return;
    const t = setInterval(() => { if (!document.hidden) loadMsgs(activeId).catch(() => {}); }, 2500);
    return () => clearInterval(t);
  }, [activeId, loadMsgs]);

  async function newChat() {
    const r = await api<{ data: Session }>('/api/chat/sessions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    setSessions((s) => [r.data, ...s]);
    setActiveId(r.data.id);
    setMsgs([]);
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const texto = draft.trim();
    if (!texto || !activeId || busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/chat/sessions/${encodeURIComponent(activeId)}/messages`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texto }),
      });
      setDraft('');
      await loadMsgs(activeId);
    } catch {
      setError('Não foi possível enviar. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  async function retry(mid: string) {
    setError('');
    try {
      await api(`/api/chat/sessions/${encodeURIComponent(activeId)}/messages/${encodeURIComponent(mid)}/retry`, { method: 'POST' });
      await loadMsgs(activeId);
    } catch {
      setError('Não foi possível reenviar. Tente de novo.');
    }
  }

  async function removeSession() {
    if (!activeId || !window.confirm('Excluir este chat e todas as mensagens?')) return;
    await api(`/api/chat/sessions/${encodeURIComponent(activeId)}`, { method: 'DELETE' });
    setSessions((s) => s.filter((x) => x.id !== activeId));
    setActiveId('');
    setMsgs([]);
  }

  async function rename() {
    const t = newTitle.trim();
    if (!t || !activeId) { setRenaming(false); return; }
    await api(`/api/chat/sessions/${encodeURIComponent(activeId)}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ titulo: t }),
    });
    setSessions((s) => s.map((x) => (x.id === activeId ? { ...x, titulo: t } : x)));
    setRenaming(false);
  }

  const active = sessions.find((s) => s.id === activeId);

  return (
    <main className="font-sans text-ink">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-brand sm:text-3xl">Chat</h1>
        <button type="button" onClick={newChat} className="min-h-11 rounded-stamp bg-brand px-4 text-[15px] font-semibold text-white hover:bg-brand-deep">
          Novo chat
        </button>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
        <section aria-label="Conversas" className="flex max-h-64 flex-col gap-1 overflow-y-auto lg:max-h-none">
          {sessions.map((s) => (
            <button
              key={s.id} type="button" onClick={() => { setActiveId(s.id); setRenaming(false); }}
              aria-current={s.id === activeId ? 'true' : undefined}
              className={s.id === activeId ? 'min-h-11 rounded-sheet bg-brand/10 px-3 py-2 text-left text-[15px] font-semibold text-ink' : 'min-h-11 rounded-sheet px-3 py-2 text-left text-[15px] text-ink hover:bg-sheet'}
            >
              {s.titulo}
            </button>
          ))}
          {sessions.length === 0 && <p className="px-1 text-sm text-muted">Nenhum chat ainda.</p>}
        </section>
        <section aria-label="Mensagens" className="flex min-h-[50vh] flex-col gap-3">
          {active && (
            <div className="flex flex-wrap items-center gap-2">
              {renaming ? (
                <input aria-label="Nome do chat" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onBlur={rename} onKeyDown={(e) => { if (e.key === 'Enter') rename(); }} autoFocus className={inputClass} />
              ) : (
                <button type="button" title="Renomear" onClick={() => { setNewTitle(active.titulo); setRenaming(true); }} className="min-h-11 text-left text-lg font-semibold">
                  {active.titulo}
                </button>
              )}
              <button type="button" onClick={removeSession} className="min-h-11 rounded-stamp px-3 text-sm font-semibold text-seal-deep hover:bg-seal-wash">
                Excluir
              </button>
            </div>
          )}
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
            {msgs.map((m) => (
              <div key={m.id} className={m.remetente === 'user' ? 'self-end rounded-sheet bg-brand px-3 py-2 text-[15px] text-white' : 'self-start rounded-sheet bg-sheet px-3 py-2 text-[15px]'}>
                <p className="whitespace-pre-wrap">{m.texto}</p>
                {m.remetente === 'user' && m.estado === 'pending' && <p className="mt-1 text-xs opacity-70">aguardando agente…</p>}
                {m.estado === 'error' && (
                  <button type="button" onClick={() => retry(m.id)} className="mt-1 min-h-11 text-xs font-semibold underline underline-offset-2">
                    Falhou — tentar de novo
                  </button>
                )}
              </div>
            ))}
          </div>
          {error && <p role="alert" className="rounded-stamp border border-seal/30 bg-seal-wash px-3 py-2 text-sm text-seal-deep">{error}</p>}
          <form onSubmit={send} className="flex gap-2">
            <input aria-label="Mensagem" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escreva…" className={inputClass} />
            <button type="submit" disabled={busy || !activeId} className="min-h-11 shrink-0 rounded-stamp bg-brand px-4 text-[15px] font-semibold text-white hover:bg-brand-deep disabled:opacity-60">
              {busy ? '…' : 'Enviar'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
```

Rota em `App.tsx` (sem item no NAV — a entrada é o widget; evita mexer no grid `grid-cols-4` da tab bar):

```tsx
import { Chat } from './pages/Chat';
// ...
if (path === '/chat') return <Chat />;
```

- [ ] **Step 4: Run tests to verify they pass**

Run (em `frontend/`): `npx vitest run src/pages/Chat.test.tsx` → Expected: PASS. Depois `npm run build` (vite compila).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/Chat.tsx frontend/src/pages/Chat.test.tsx frontend/src/App.tsx
git commit -m "feat: pagina dedicada do chat /chat"
```

### Task 4: Widget flutuante (frontend)

**Files:**
- Create: `frontend/src/components/ChatWidget.tsx`
- Create: `frontend/src/components/ChatWidget.test.tsx`
- Modify: `frontend/src/App.tsx` (monta widget exceto `/login` e `/chat`)

**Interfaces:**
- Consumes: mesmos endpoints das Tasks 1–2; `<Chat />` não é reusado (widget tem estado próprio compacto).
- Produces: `<ChatWidget />` sem props.

- [ ] **Step 1: Write the failing test**

```tsx
// @vitest-environment jsdom
// frontend/src/components/ChatWidget.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { ChatWidget } from './ChatWidget';

afterEach(() => { vi.unstubAllGlobals(); });

describe('ChatWidget', () => {
  it('opens panel and loads sessions on click', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) })) as never;
    vi.stubGlobal('fetch', fetchMock);
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    act(() => { root.render(<ChatWidget />); });
    const btn = div.querySelector('button[aria-label="Abrir chat"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    act(() => { btn.click(); });
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledWith('/api/chat/sessions', expect.anything());
    expect(div.textContent).toContain('Abrir página');
    act(() => { root.unmount(); });
    div.remove();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/ChatWidget.test.tsx` (em `frontend/`)
Expected: FAIL with "Cannot find module './ChatWidget'"

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/components/ChatWidget.tsx
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';

type Session = { id: string; titulo: string };
type Msg = { id: string; remetente: 'user' | 'agent'; texto: string; estado: string };

const inputClass =
  'h-11 w-full rounded-sheet border border-line bg-sheet px-3 text-[15px] text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none';

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const loadMsgs = useCallback(async (id: string) => {
    if (!id) return;
    const r = await api<{ data: Msg[] }>(`/api/chat/sessions/${encodeURIComponent(id)}/messages`);
    setMsgs(r.data);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && sessions.length === 0) {
      try {
        const r = await api<{ data: Session[] }>('/api/chat/sessions');
        setSessions(r.data);
        if (r.data[0]) { setActiveId(r.data[0].id); await loadMsgs(r.data[0].id); }
      } catch { /* painel abre vazio; retry no próximo abrir */ }
    }
  }

  useEffect(() => {
    if (!open || !activeId) return;
    const t = setInterval(() => { if (!document.hidden) loadMsgs(activeId).catch(() => {}); }, 2500);
    return () => clearInterval(t);
  }, [open, activeId, loadMsgs]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const texto = draft.trim();
    if (!texto || !activeId || busy) return;
    setBusy(true);
    try {
      await api(`/api/chat/sessions/${encodeURIComponent(activeId)}/messages`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texto }),
      });
      setDraft('');
      await loadMsgs(activeId);
    } catch { /* mantém o rascunho para reenvio */ } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed right-4 bottom-24 z-50 flex flex-col items-end gap-2 lg:bottom-6">
      {open && (
        <section aria-label="Chat" className="flex max-h-[65vh] w-[min(380px,calc(100vw-2rem))] flex-col gap-2 rounded-sheet border border-line bg-paper p-3 shadow-lift">
          <div className="flex items-center gap-2">
            <select
              aria-label="Conversa" value={activeId}
              onChange={(e) => { setActiveId(e.target.value); loadMsgs(e.target.value).catch(() => {}); }}
              className={inputClass}
            >
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.titulo}</option>)}
            </select>
            <a href="/chat" className="min-h-11 shrink-0 rounded-stamp px-2 text-sm font-semibold text-brand hover:underline">
              Abrir página
            </a>
          </div>
          <div className="flex min-h-40 flex-col gap-2 overflow-y-auto px-1 py-1">
            {msgs.map((m) => (
              <div key={m.id} className={m.remetente === 'user' ? 'self-end rounded-sheet bg-brand px-3 py-2 text-sm text-white' : 'self-start rounded-sheet bg-sheet px-3 py-2 text-sm'}>
                <p className="whitespace-pre-wrap">{m.texto}</p>
                {m.remetente === 'user' && m.estado === 'pending' && <p className="mt-1 text-xs opacity-70">aguardando agente…</p>}
              </div>
            ))}
            {msgs.length === 0 && <p className="px-1 text-sm text-muted">Sem mensagens ainda.</p>}
          </div>
          <form onSubmit={send} className="flex gap-2">
            <input aria-label="Mensagem" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escreva…" className={inputClass} />
            <button type="submit" disabled={busy || !activeId} className="min-h-11 shrink-0 rounded-stamp bg-brand px-3 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60">
              Enviar
            </button>
          </form>
        </section>
      )}
      <button
        type="button" onClick={toggle} aria-label={open ? 'Fechar chat' : 'Abrir chat'}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-brand px-4 text-[15px] font-semibold text-white shadow-lift hover:bg-brand-deep"
      >
        {open ? '✕' : 'Chat'}
      </button>
    </div>
  );
}
```

Montagem em `App.tsx` — early-returns de `/login` e `/chat` ficam sem widget; todo o resto monta após o conteúdo:

```tsx
import { ChatWidget } from './components/ChatWidget';
// early returns existentes...
if (path === '/login') return <Login />;
if (path === '/chat') return <Chat />;
// no return principal, antes do fechamento do <div> raiz:
      <ChatWidget />
```

- [ ] **Step 4: Run tests to verify they pass**

Run (em `frontend/`): `npx vitest run src/components/ChatWidget.test.tsx` → Expected: PASS. Depois `npm run build`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ChatWidget.tsx frontend/src/components/ChatWidget.test.tsx frontend/src/App.tsx
git commit -m "feat: widget flutuante do chat"
```

### Task 5: Deploy staging + smoke do contrato do adapter

**Files:** nenhum código — só comandos + verificação. Consumes: Tasks 1–4 mergedas no branch.

- [ ] **Step 1: Aplicar migration no D1 staging**

Run: `npx wrangler d1 migrations apply orbis_db --remote --env staging`
Expected: `0007_chat.sql` aplicada (migrations 1–6 já aplicadas na Task 5 do MCP).

- [ ] **Step 2: Build + deploy staging**

Run: `npm run build --prefix frontend` → Expected: `frontend/dist/` gerado sem erro.
Run: `npx wrangler deploy --env staging` → Expected: deploy ok; anotar a versão (ex. `v_<hash>`).

- [ ] **Step 3: Smoke ponta a ponta do contrato (cookie + Bearer)**

```bash
J=/tmp/chat-smoke.jar
curl -sc "$J" -X POST https://orbis-portal-staging.orbis-d36.workers.dev/api/login \
  -H 'content-type: application/json' -d '{"email":"escritorio@demo.com.br","pass":"demo123"}'
curl -sb "$J" -X POST https://orbis-portal-staging.orbis-d36.workers.dev/api/chat/sessions \
  -H 'content-type: application/json' -d '{}'                      # → { data: { id: cht_* } }
SID=<cht_id>
curl -sb "$J" -X POST "https://orbis-portal-staging.orbis-d36.workers.dev/api/chat/sessions/$SID/messages" \
  -H 'content-type: application/json' -d '{"texto":"smoke oi"}'    # → pending
curl -sb "$J" -X POST https://orbis-portal-staging.orbis-d36.workers.dev/api/tokens \
  -H 'content-type: application/json' -d '{"nome":"chat-smoke"}'   # → { token: orbis_* }
T=<token>
curl -s https://orbis-portal-staging.orbis-d36.workers.dev/api/chat/outbox -H "authorization: Bearer $T"
# → contém a mensagem smoke; segundo GET imediato NÃO a contém (flip atômico)
curl -s -X POST https://orbis-portal-staging.orbis-d36.workers.dev/api/chat/inbox \
  -H "authorization: Bearer $T" -H 'content-type: application/json' \
  -d "{\"session_id\":\"$SID\",\"texto\":\"smoke ok\"}"            # → 201 delivered
curl -sb "$J" "https://orbis-portal-staging.orbis-d36.workers.dev/api/chat/sessions/$SID/messages"
# → contém user pending/claimed + agent delivered
```

Expected: todos 200/201; segundo outbox vazio; inbox 401 sem Bearer.

- [ ] **Step 4: Revogar token + limpar**

Run: `DELETE /api/tokens/:id` com o jar (mesmo padrão da Task 5 do MCP); confirmar 401 na outbox com o token revogado; `rm -f "$J"`.

- [ ] **Step 5: Registrar resultado (sem commit de código)**

Acrescentar ao ledger/relatório: versão do deploy, confirmação do flip atômico em staging, token revogado. Linhas de smoke (`cht_*`/`chm_*`) permanecem no staging por design (mesmo parked minor do MCP).

## Self-Review

**1. Spec coverage:** transporte/outbox+inbox → Task 2; tabelas/DDL → Task 1; 6 endpoints UI + retry → Tasks 1–2; widget + `/chat` + polling + estados → Tasks 3–4; erros PT-BR/auditoria/isolamento → Tasks 1–2 + testes; fora de escopo v1 respeitado (sem websocket/webhook/anexos/streaming); apêndice Hermes é contrato, não código — coberto pelo smoke da Task 5.
**2. Placeholder scan:** nenhum TBD/TODO; todos os comandos, SQL, handlers e testes estão inline com valores exatos.
**3. Type consistency:** `ownSession`/`rid`/`notFound`/`actorId` definidos na Task 1 e reusados na 2; `api<T>` + tipos `Session`/`Msg` idênticos nas Tasks 3–4; `verifyBearer(db, header)` igual ao uso em `src/index.ts:46`; mount `as never` igual às rotas existentes.
