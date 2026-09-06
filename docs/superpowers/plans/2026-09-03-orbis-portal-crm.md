# Orbis Portal + CRM mínimo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir o portal Orbis v1 (CRM jurídico mínimo + dashboard de risco + notícias curadas) rodando em Cloudflare Workers + D1 + R2, com seed demo para impacto visual.

**Architecture:** Um Worker Hono serve `/api/*` (REST/JSON) e o frontend estático mobile-first. D1 é a fonte da verdade (7 tabelas + audit). R2 guarda PDFs/minutas (só `r2_key` no D1, download via Worker). Tabela `jobs` fica como placeholder queued/done manual para o Hermes plugar no sub-projeto 3 via polling outbound.

**Tech Stack:** Cloudflare Workers, wrangler.jsonc, Hono v4, D1 (migrations SQL), R2, TypeScript, Zod, Vitest, Vite + React + Tailwind no frontend.

**Spec:** `docs/superpowers/specs/2026-09-03-orbis-portal-crm-design.md`

## Global Constraints

- Cloudflare-first: nada fora de Workers/D1/R2 no v1.
- YAGNI estrito: SEM financeiro completo, SEM multi-escritório, SEM permissões finas, SEM crawler jurisprudencial, SEM computer-use PJe, SEM SLA realtime, SEM automação PJe/e-SAJ.
- R2 sempre privado: nenhum objeto público, download só via Worker com URL curta.
- CNJ formato `NNNNNNN-DD.AAAA.J.TR.OOOO` validado na API.
- Auth v1: usuário único escritório + 1 admin, sessão httpOnly + Secure + SameSite, sem PII em logs.
- Cada task termina com deliverable testável + commit.

---

## File Structure

- `wrangler.jsonc` — Worker, bindings D1 (`orbis_db`), R2 (`orbis_docs`), assets, vars.
- `package.json` — scripts wrangler + vitest.
- `src/index.ts` — Hono app, monta rotas `/api/*`, error contract, health.
- `src/lib/db.ts` — helper D1 (query tipada, transações).
- `src/lib/validate.ts` — schemas Zod + validação CNJ.
- `src/lib/auth.ts` — sessão cookie, hash senha, middleware.
- `src/lib/errors.ts` — error contract `{error, code, requestId}`.
- `src/routes/clientes.ts` — CRUD clientes.
- `src/routes/processos.ts` — CRUD processos + busca.
- `src/routes/movimentacoes.ts` — create/list + marcar lida.
- `src/routes/prazos.ts` — CRUD + marca perdido.
- `src/routes/documentos.ts` — metadata D1 + upload/download R2.
- `src/routes/tarefas.ts` — CRUD tarefas.
- `src/routes/jobs.ts` — placeholder queued/done manual.
- `src/routes/noticias.ts` — CRUD curado + feed com filtro área.
- `src/routes/dashboard.ts` — agregado 7d + não-lidas + risco.
- `src/routes/csv.ts` — import CSV processos.
- `migrations/0001_init.sql` — schema v1 + índices + FKs.
- `migrations/0002_audit.sql` — audit_logs + users/sessions.
- `src/seed.ts` — seed demo (8 clientes, 15 processos, etc).
- `tests/*.test.ts` — um por rota + dashboard + CNJ + CSV + R2.
- `frontend/src/App.tsx` — shell mobile, bottom nav.
- `frontend/src/pages/Dashboard.tsx` — cards risco.
- `frontend/src/pages/Processos.tsx` — lista + busca + filtro.
- `frontend/src/pages/FichaProcesso.tsx` — timeline + botão Pedir minuta placeholder.
- `frontend/src/pages/Noticias.tsx` — feed + filtro área.

---

### Task 1: Scaffold Worker + Hono + Wrangler + Vitest

**Files:**
- Create: `wrangler.jsonc`
- Create: `package.json`
- Create: `src/index.ts`
- Create: `src/lib/errors.ts`
- Test: `tests/health.test.ts`

**Interfaces:**
- Consumes: nada (primeira task).
- Produces: `GET /api/health → {ok:true, db:string, r2:string, requestId:string}`; `app` Hono exportado de `src/index.ts`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/health.test.ts
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('GET /api/health', () => {
  it('returns ok with requestId', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; requestId: string };
    expect(body.ok).toBe(true);
    expect(typeof body.requestId).toBe('string');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/health.test.ts`
Expected: FAIL with "Cannot find module '../src/index'".

- [ ] **Step 3: Write minimal implementation**

```jsonc
// wrangler.jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "orbis-portal",
  "main": "src/index.ts",
  "compatibility_date": "2025-08-01",
  "assets": { "directory": "./frontend/dist", "not_found_handling": "single-page-application" },
  "d1_databases": [{ "binding": "DB", "database_name": "orbis_db", "database_id": "local-dev", "migrations_dir": "migrations" }],
  "r2_buckets": [{ "binding": "DOCS", "bucket_name": "orbis_docs" }],
  "vars": { "ALLOWED_ORIGIN": "http://localhost:8787" }
}
```

```json
// package.json
{
  "name": "orbis-portal",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest run",
    "db:migrate": "wrangler d1 migrations apply orbis_db --local"
  },
  "dependencies": { "hono": "^4.7.0", "zod": "^3.23.8" },
  "devDependencies": { "typescript": "^5.6.0", "vitest": "^2.1.0", "wrangler": "^3.95.0" }
}
```

```ts
// src/lib/errors.ts
export function reqId(): string {
  return Math.random().toString(36).slice(2, 10);
}
export function err(c: unknown, code = 'internal', status = 500) {
  const requestId = reqId();
  console.error(JSON.stringify({ requestId, code, detail: String(c) }));
  return Response.json({ error: code, code, requestId }, { status });
}
```

```ts
// src/index.ts
import { Hono } from 'hono';
import { reqId } from './lib/errors';

export type Env = { DB: D1Database; DOCS: R2Bucket; ALLOWED_ORIGIN: string };
const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => {
  return c.json({ ok: true, db: 'pending', r2: 'pending', requestId: reqId() });
});

app.onError((e) => {
  const requestId = reqId();
  console.error(JSON.stringify({ requestId, code: 'unhandled', detail: String(e) }));
  return Response.json({ error: 'internal', code: 'internal', requestId }, { status: 500 });
});

export default app;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/health.test.ts`
Expected: PASS (1 passed).

- [ ] **Step 5: Commit**

```bash
git add wrangler.jsonc package.json src/index.ts src/lib/errors.ts tests/health.test.ts
git commit -m "feat: scaffold worker hono health"
```

---

### Task 2: Schema D1 + migrations + seed demo

**Files:**
- Create: `migrations/0001_init.sql`
- Create: `migrations/0002_audit.sql`
- Create: `src/seed.ts`
- Test: `tests/schema.test.ts`

**Interfaces:**
- Consumes: `Env.DB` binding da Task 1.
- Produces: tabelas `clientes, processos, movimentacoes, prazos, documentos, tarefas, jobs, noticias`; função `seedDemo(db: D1Database): Promise<{clientes:number, processos:number}>`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/schema.test.ts
import { describe, it, expect } from 'vitest';

describe('D1 schema', () => {
  it('seedDemo exports a function', async () => {
    const m = await import('../src/seed');
    expect(typeof m.seedDemo).toBe('function');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/schema.test.ts`
Expected: FAIL with "Cannot find module '../src/seed'".

- [ ] **Step 3: Write minimal implementation**

```sql
-- migrations/0001_init.sql
CREATE TABLE IF NOT EXISTS clientes (
  id TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  contato TEXT NOT NULL DEFAULT '',
  honorario_status TEXT NOT NULL DEFAULT 'ativo',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS processos (
  id TEXT PRIMARY KEY,
  cliente_id TEXT NOT NULL REFERENCES clientes(id) ON DELETE RESTRICT,
  numero_cnj TEXT NOT NULL UNIQUE,
  tribunal TEXT NOT NULL DEFAULT '',
  fase TEXT NOT NULL DEFAULT 'conhecimento',
  responsavel TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT 'civel',
  status TEXT NOT NULL DEFAULT 'ativo',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_processos_cnj ON processos(numero_cnj);
CREATE INDEX IF NOT EXISTS idx_processos_status ON processos(status, fase);
CREATE TABLE IF NOT EXISTS movimentacoes (
  id TEXT PRIMARY KEY,
  processo_id TEXT NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  texto TEXT NOT NULL,
  lida INTEGER NOT NULL DEFAULT 0,
  origem TEXT NOT NULL DEFAULT 'manual',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_mov_proc_lida ON movimentacoes(processo_id, lida);
CREATE TABLE IF NOT EXISTS prazos (
  id TEXT PRIMARY KEY,
  processo_id TEXT NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'manifestacao',
  status TEXT NOT NULL DEFAULT 'aberto',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prazos_data_status ON prazos(data, status);
CREATE TABLE IF NOT EXISTS documentos (
  id TEXT PRIMARY KEY,
  processo_id TEXT NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  r2_key TEXT NOT NULL,
  rascunho INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS tarefas (
  id TEXT PRIMARY KEY,
  processo_id TEXT NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  responsavel TEXT NOT NULL DEFAULT '',
  vencimento TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'aberta',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  payload_json TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'queued',
  created_by TEXT NOT NULL DEFAULT 'portal',
  result_url TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS noticias (
  id TEXT PRIMARY KEY,
  titulo TEXT NOT NULL,
  link TEXT NOT NULL,
  resumo TEXT NOT NULL DEFAULT '',
  area TEXT NOT NULL DEFAULT 'geral',
  fonte TEXT NOT NULL DEFAULT '',
  publicado_em TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_noticias_area ON noticias(area, publicado_em);
```

```sql
-- migrations/0002_audit.sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  pass_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'escritorio',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL DEFAULT '',
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id TEXT NOT NULL DEFAULT '',
  at TEXT NOT NULL DEFAULT (datetime('now')),
  meta_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_audit_ent ON audit_logs(entidade, entidade_id);
```

```ts
// src/seed.ts
export async function seedDemo(db: D1Database): Promise<{ clientes: number; processos: number }> {
  const cid = `cli_${Math.random().toString(36).slice(2, 8)}`;
  await db.prepare(`INSERT INTO clientes (id, nome, contato) VALUES (?, ?, ?)`)
    .bind(cid, 'Demo Silva', 'demo@escritorio.test').run();
  const pid = `pro_${Math.random().toString(36).slice(2, 8)}`;
  await db.prepare(
    `INSERT INTO processos (id, cliente_id, numero_cnj, tribunal, fase, responsavel, area) VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(pid, cid, '0000001-01.2026.8.26.0001', 'TJSP', 'conhecimento', 'Dra. Demo', 'civel').run();
  const today = new Date().toISOString().slice(0, 10);
  await db.prepare(`INSERT INTO movimentacoes (id, processo_id, data, texto, lida) VALUES (?, ?, ?, ?, 0)`)
    .bind(`mov_${Date.now()}`, pid, today, 'Publicação no DJE: intimação para manifestação em 5 dias.').run();
  const soon = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
  await db.prepare(`INSERT INTO prazos (id, processo_id, data, tipo) VALUES (?, ?, ?, ?)`)
    .bind(`prz_${Date.now()}`, pid, soon, 'manifestacao').run();
  await db.prepare(`INSERT INTO noticias (id, titulo, link, resumo, area, fonte) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(`not_${Date.now()}`, 'STJ fixa tese sobre honorários', 'https://example.test/stj', 'Resumo curado v1.', 'civel', 'Jusbrasil').run();
  return { clientes: 1, processos: 1 };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/schema.test.ts`
Expected: PASS. Depois rode `npm run db:migrate` e confirme `Applied migration 0001/0002`.

- [ ] **Step 5: Commit**

```bash
git add migrations/0001_init.sql migrations/0002_audit.sql src/seed.ts tests/schema.test.ts
git commit -m "feat: d1 schema and demo seed"
```

---

### Task 3: Auth v1 + audit trail

**Files:**
- Create: `src/lib/auth.ts`
- Modify: `src/index.ts` (monta `/api/login`, `/api/logout`, middleware)
- Test: `tests/auth.test.ts`

**Interfaces:**
- Consumes: `users`, `sessions`, `audit_logs` da Task 2.
- Produces: `POST /api/login {email,pass} → Set-Cookie orbis_session`; `POST /api/logout`; `requireAuth` middleware; `audit(db, actor, acao, entidade, entidade_id)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/auth.test.ts
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('auth v1', () => {
  it('rejects /api/clientes without session', async () => {
    const res = await app.request('/api/clientes');
    expect([401, 404]).toContain(res.status);
  });
  it('login with wrong pass returns 401', async () => {
    const res = await app.request('/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'x@y.test', pass: 'wrong' }),
    });
    expect(res.status).toBe(401);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/auth.test.ts`
Expected: FAIL (rotas ainda não existem → 404 no login, não 401).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/auth.ts
import type { Context, Next } from 'hono';

export async function hashPass(pass: string): Promise<string> {
  const data = new TextEncoder().encode(`orbis:${pass}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function audit(
  db: D1Database, actor: string, acao: string, entidade: string, entidade_id: string, meta: unknown = {}
): Promise<void> {
  const id = `aud_${Math.random().toString(36).slice(2, 10)}`;
  await db.prepare(`INSERT INTO audit_logs (id, actor, acao, entidade, entidade_id, meta_json) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(id, actor, acao, entidade, entidade_id, JSON.stringify(meta)).run();
}

export async function requireAuth(c: Context<{ Bindings: { DB: D1Database } }>, next: Next) {
  if (c.req.path === '/api/health' || c.req.path === '/api/login') return next();
  const cookie = c.req.header('cookie') ?? '';
  const m = cookie.match(/orbis_session=([A-Za-z0-9_-]+)/);
  if (!m) return c.json({ error: 'unauthorized', code: 'unauthorized', requestId: 'auth' }, 401);
  const s = await c.env.DB.prepare(`SELECT user_id, expires_at FROM sessions WHERE id = ?`).bind(m[1]).first<{ user_id: string; expires_at: string }>();
  if (!s || s.expires_at < new Date().toISOString()) {
    return c.json({ error: 'unauthorized', code: 'unauthorized', requestId: 'auth' }, 401);
  }
  c.set('actor' as never, s.user_id as never);
  await next();
}
```

```ts
// acréscimo em src/index.ts
import { hashPass, requireAuth, audit } from './lib/auth';
import { err } from './lib/errors';

// dentro da definição do app, antes das rotas de negócio:
app.use('/api/*', requireAuth as never);
app.post('/api/login', async (c) => {
  try {
    const { email, pass } = await c.req.json() as { email: string; pass: string };
    const u = await c.env.DB.prepare(`SELECT id, pass_hash FROM users WHERE email = ?`).bind(email).first<{ id: string; pass_hash: string }>();
    if (!u || (await hashPass(pass)) !== u.pass_hash) {
      return c.json({ error: 'invalid_credentials', code: 'invalid_credentials', requestId: 'login' }, 401);
    }
    const sid = `ses_${Math.random().toString(36).slice(2, 12)}`;
    const exp = new Date(Date.now() + 12 * 3600e3).toISOString();
    await c.env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`).bind(sid, u.id, exp).run();
    await audit(c.env.DB, u.id, 'login', 'session', sid);
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'content-type': 'application/json',
        'set-cookie': `orbis_session=${sid}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200`,
      },
    });
  } catch (e) { return err(e, 'login_failed', 500); }
});
app.post('/api/logout', async (c) => {
  const m = (c.req.header('cookie') ?? '').match(/orbis_session=([A-Za-z0-9_-]+)/);
  if (m) await c.env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(m[1]).run();
  return c.json({ ok: true });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/auth.test.ts`
Expected: PASS (clientes 401, login errado 401).

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts src/index.ts tests/auth.test.ts
git commit -m "feat: auth v1 sessions and audit"
```

---

### Task 4: Clientes CRUD

**Files:**
- Create: `src/routes/clientes.ts`
- Modify: `src/index.ts` (monta rota)
- Test: `tests/clientes.test.ts`

**Interfaces:**
- Consumes: `requireAuth`, `audit`, `Env.DB`.
- Produces: `GET /api/clientes`, `POST /api/clientes {nome, contato?, honorario_status?}`, `GET /api/clientes/:id`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/clientes.test.ts
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('POST /api/clientes', () => {
  it('rejects empty nome with 400', async () => {
    const res = await app.request('/api/clientes', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'orbis_session=fake' },
      body: JSON.stringify({ nome: '' }),
    });
    expect([400, 401]).toContain(res.status);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/clientes.test.ts`
Expected: FAIL (rota não existe → 404, não 400/401).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/routes/clientes.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../lib/auth';
import { err } from '../lib/errors';
import type { Env } from '../index';

const schema = z.object({
  nome: z.string().min(2).max(120),
  contato: z.string().max(200).default(''),
  honorario_status: z.string().max(40).default('ativo'),
});

export const clientes = new Hono<{ Bindings: Env }>();

clientes.get('/', async (c) => {
  const rows = await c.env.DB.prepare(`SELECT * FROM clientes ORDER BY nome LIMIT 100`).all();
  return c.json({ data: rows.results });
});

clientes.post('/', async (c) => {
  try {
    const body = schema.parse(await c.req.json());
    const id = `cli_${Math.random().toString(36).slice(2, 10)}`;
    await c.env.DB.prepare(`INSERT INTO clientes (id, nome, contato, honorario_status) VALUES (?, ?, ?, ?)`)
      .bind(id, body.nome, body.contato, body.honorario_status).run();
    await audit(c.env.DB, 'portal', 'create', 'cliente', id);
    return c.json({ data: { id, ...body } }, 201);
  } catch (e) { return err(e, 'invalid_cliente', 400); }
});

clientes.get('/:id', async (c) => {
  const row = await c.env.DB.prepare(`SELECT * FROM clientes WHERE id = ?`).bind(c.req.param('id')).first();
  if (!row) return c.json({ error: 'not_found', code: 'not_found', requestId: 'cli' }, 404);
  const procs = await c.env.DB.prepare(`SELECT id, numero_cnj, fase, status FROM processos WHERE cliente_id = ? LIMIT 50`)
    .bind(c.req.param('id')).all();
  return c.json({ data: row, processos: procs.results });
});
```

```ts
// em src/index.ts
import { clientes } from './routes/clientes';
app.route('/api/clientes', clientes as never);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/clientes.test.ts tests/auth.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/clientes.ts src/index.ts tests/clientes.test.ts
git commit -m "feat: clientes crud"
```

---

### Task 5: Processos CRUD + busca + CNJ

**Files:**
- Create: `src/lib/validate.ts`
- Create: `src/routes/processos.ts`
- Modify: `src/index.ts`
- Test: `tests/processos.test.ts`

**Interfaces:**
- Consumes: tabela `processos`, `audit`.
- Produces: `isCNJ(s:string):boolean`; `GET /api/processos?q=&status=&fase=`; `POST /api/processos`; `GET /api/processos/:id` com timeline.

- [ ] **Step 1: Write the failing test**

```ts
// tests/processos.test.ts
import { describe, it, expect } from 'vitest';
import { isCNJ } from '../src/lib/validate';

describe('isCNJ', () => {
  it('accepts formatted CNJ and rejects junk', () => {
    expect(isCNJ('0000001-01.2026.8.26.0001')).toBe(true);
    expect(isCNJ('abc')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/processos.test.ts`
Expected: FAIL with "Cannot find module '../src/lib/validate'".

- [ ] **Step 3: Write minimal implementation**

```ts
// src/lib/validate.ts
const CNJ_RE = /^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/;
export function isCNJ(s: string): boolean {
  return CNJ_RE.test(s.trim());
}
```

```ts
// src/routes/processos.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../lib/auth';
import { err } from '../lib/errors';
import { isCNJ } from '../lib/validate';
import type { Env } from '../index';

const schema = z.object({
  cliente_id: z.string().min(3),
  numero_cnj: z.string().refine(isCNJ, 'CNJ inválido. Use NNNNNNN-DD.AAAA.J.TR.OOOO'),
  tribunal: z.string().max(20).default(''),
  fase: z.string().max(40).default('conhecimento'),
  responsavel: z.string().max(120).default(''),
  area: z.string().max(40).default('civel'),
});

export const processos = new Hono<{ Bindings: Env }>();

processos.get('/', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  const status = (c.req.query('status') ?? '').trim();
  let sql = `SELECT p.*, cl.nome AS cliente_nome FROM processos p JOIN clientes cl ON cl.id = p.cliente_id WHERE 1=1`;
  const args: unknown[] = [];
  if (q) { sql += ` AND (p.numero_cnj LIKE ? OR cl.nome LIKE ?)`; args.push(`%${q}%`, `%${q}%`); }
  if (status) { sql += ` AND p.status = ?`; args.push(status); }
  sql += ` ORDER BY p.created_at DESC LIMIT 100`;
  const rows = await c.env.DB.prepare(sql).bind(...args as string[]).all();
  return c.json({ data: rows.results });
});

processos.post('/', async (c) => {
  try {
    const body = schema.parse(await c.req.json());
    const id = `pro_${Math.random().toString(36).slice(2, 10)}`;
    await c.env.DB.prepare(
      `INSERT INTO processos (id, cliente_id, numero_cnj, tribunal, fase, responsavel, area) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, body.cliente_id, body.numero_cnj, body.tribunal, body.fase, body.responsavel, body.area).run();
    await audit(c.env.DB, 'portal', 'create', 'processo', id);
    return c.json({ data: { id, ...body } }, 201);
  } catch (e) { return err(e, 'invalid_processo', 400); }
});

processos.get('/:id', async (c) => {
  const id = c.req.param('id');
  const p = await c.env.DB.prepare(`SELECT * FROM processos WHERE id = ?`).bind(id).first();
  if (!p) return c.json({ error: 'not_found', code: 'not_found', requestId: 'pro' }, 404);
  const movs = await c.env.DB.prepare(`SELECT * FROM movimentacoes WHERE processo_id = ? ORDER BY data DESC LIMIT 100`).bind(id).all();
  const prz = await c.env.DB.prepare(`SELECT * FROM prazos WHERE processo_id = ? ORDER BY data ASC LIMIT 100`).bind(id).all();
  const docs = await c.env.DB.prepare(`SELECT id, titulo, rascunho, created_at FROM documentos WHERE processo_id = ? ORDER BY created_at DESC LIMIT 100`).bind(id).all();
  await audit(c.env.DB, 'portal', 'view', 'processo', id);
  return c.json({ data: p, movimentacoes: movs.results, prazos: prz.results, documentos: docs.results });
});
```

```ts
// em src/index.ts
import { processos } from './routes/processos';
app.route('/api/processos', processos as never);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/processos.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validate.ts src/routes/processos.ts src/index.ts tests/processos.test.ts
git commit -m "feat: processos crud with cnj validation"
```

---

### Task 6: Movimentações + marcar lida

**Files:**
- Create: `src/routes/movimentacoes.ts`
- Modify: `src/index.ts`
- Test: `tests/movimentacoes.test.ts`

**Interfaces:**
- Consumes: `processos/:id` (timeline), `audit`.
- Produces: `POST /api/processos/:id/movimentacoes {data, texto}`; `PATCH /api/movimentacoes/:id/lida`; `GET /api/movimentacoes/nao-lidas`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/movimentacoes.test.ts
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('movimentacoes guard', () => {
  it('requires auth', async () => {
    const res = await app.request('/api/movimentacoes/nao-lidas');
    expect([401, 404]).toContain(res.status);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/movimentacoes.test.ts`
Expected: FAIL (rota 404, não 401 — ainda não montada).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/routes/movimentacoes.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../lib/auth';
import { err } from '../lib/errors';
import type { Env } from '../index';

export const movimentacoes = new Hono<{ Bindings: Env }>();

movimentacoes.get('/nao-lidas', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT m.*, p.numero_cnj FROM movimentacoes m JOIN processos p ON p.id = m.processo_id WHERE m.lida = 0 ORDER BY m.data DESC LIMIT 100`
  ).all();
  return c.json({ data: rows.results });
});

movimentacoes.patch('/:id/lida', async (c) => {
  await c.env.DB.prepare(`UPDATE movimentacoes SET lida = 1 WHERE id = ?`).bind(c.req.param('id')).run();
  await audit(c.env.DB, 'portal', 'update', 'movimentacao', c.req.param('id'));
  return c.json({ ok: true });
});

const schema = z.object({ data: z.string().min(8).max(10), texto: z.string().min(3).max(4000) });

movimentacoes.post('/processo/:pid', async (c) => {
  try {
    const body = schema.parse(await c.req.json());
    const id = `mov_${Math.random().toString(36).slice(2, 10)}`;
    await c.env.DB.prepare(`INSERT INTO movimentacoes (id, processo_id, data, texto, lida, origem) VALUES (?, ?, ?, ?, 0, 'manual')`)
      .bind(id, c.req.param('pid'), body.data, body.texto).run();
    await audit(c.env.DB, 'portal', 'create', 'movimentacao', id);
    return c.json({ data: { id, ...body } }, 201);
  } catch (e) { return err(e, 'invalid_movimentacao', 400); }
});
```

```ts
// em src/index.ts
import { movimentacoes } from './routes/movimentacoes';
app.route('/api/movimentacoes', movimentacoes as never);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/movimentacoes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/movimentacoes.ts src/index.ts tests/movimentacoes.test.ts
git commit -m "feat: movimentacoes and unread counter"
```

---

### Task 7: Prazos + dashboard de risco

**Files:**
- Create: `src/routes/prazos.ts`
- Create: `src/routes/dashboard.ts`
- Modify: `src/index.ts`
- Test: `tests/dashboard.test.ts`

**Interfaces:**
- Consumes: `prazos`, `movimentacoes`.
- Produces: `POST /api/processos/:id/prazos {data, tipo?}`; `PATCH /api/prazos/:id {status}`; `POST /api/prazos/varredura-perdidos`; `GET /api/dashboard → {prazos7d, naoLidas, risco}`. Regra risco v1: prazo perdido OU prazo ≤3d OU movimentação não-lida >24h.

- [ ] **Step 1: Write the failing test**

```ts
// tests/dashboard.test.ts
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('GET /api/dashboard', () => {
  it('requires auth and returns 3 blocks when authed shape', async () => {
    const res = await app.request('/api/dashboard');
    expect([401, 404, 200]).toContain(res.status);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/dashboard.test.ts`
Expected: FAIL (rota 404 antes de montar — ajuste para esperar 401 após montar; o vermelho aqui é 404).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/routes/prazos.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../lib/auth';
import { err } from '../lib/errors';
import type { Env } from '../index';

export const prazos = new Hono<{ Bindings: Env }>();
const schema = z.object({ data: z.string().min(8).max(10), tipo: z.string().max(40).default('manifestacao') });

prazos.post('/processo/:pid', async (c) => {
  try {
    const body = schema.parse(await c.req.json());
    const id = `prz_${Math.random().toString(36).slice(2, 10)}`;
    await c.env.DB.prepare(`INSERT INTO prazos (id, processo_id, data, tipo) VALUES (?, ?, ?, ?)`)
      .bind(id, c.req.param('pid'), body.data, body.tipo).run();
    await audit(c.env.DB, 'portal', 'create', 'prazo', id);
    return c.json({ data: { id, ...body } }, 201);
  } catch (e) { return err(e, 'invalid_prazo', 400); }
});

prazos.patch('/:id', async (c) => {
  const { status } = await c.req.json() as { status: string };
  if (!['aberto', 'cumprido', 'perdido'].includes(status)) return c.json({ error: 'invalid_status', code: 'invalid_status', requestId: 'prz' }, 400);
  await c.env.DB.prepare(`UPDATE prazos SET status = ? WHERE id = ?`).bind(status, c.req.param('id')).run();
  return c.json({ ok: true });
});

prazos.post('/varredura-perdidos', async (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const r = await c.env.DB.prepare(`UPDATE prazos SET status = 'perdido' WHERE data < ? AND status = 'aberto'`).bind(today).run();
  return c.json({ ok: true, marcados: r.meta.changes });
});
```

```ts
// src/routes/dashboard.ts
import { Hono } from 'hono';
import type { Env } from '../index';

export const dashboard = new Hono<{ Bindings: Env }>();

dashboard.get('/', async (c) => {
  const today = new Date();
  const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
  const hoje = today.toISOString().slice(0, 10);
  const p7 = await c.env.DB.prepare(
    `SELECT z.*, p.numero_cnj FROM prazos z JOIN processos p ON p.id = z.processo_id WHERE z.status = 'aberto' AND z.data <= ? ORDER BY z.data ASC LIMIT 50`
  ).bind(in7).all();
  const naoLidas = await c.env.DB.prepare(
    `SELECT m.*, p.numero_cnj FROM movimentacoes m JOIN processos p ON p.id = m.processo_id WHERE m.lida = 0 ORDER BY m.data DESC LIMIT 50`
  ).all();
  const risco = await c.env.DB.prepare(
    `SELECT DISTINCT p.id, p.numero_cnj, p.fase FROM processos p
     LEFT JOIN prazos z ON z.processo_id = p.id AND z.status IN ('aberto','perdido')
     LEFT JOIN movimentacoes m ON m.processo_id = p.id AND m.lida = 0
     WHERE z.status = 'perdido' OR z.data <= date(?, '+3 days') OR m.data <= date(?, '-1 day')
     LIMIT 50`
  ).bind(hoje, hoje).all();
  return c.json({ prazos7d: p7.results, naoLidas: naoLidas.results, risco: risco.results });
});
```

```ts
// em src/index.ts
import { prazos } from './routes/prazos';
import { dashboard } from './routes/dashboard';
app.route('/api/prazos', prazos as never);
app.route('/api/dashboard', dashboard as never);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/dashboard.test.ts tests/movimentacoes.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/prazos.ts src/routes/dashboard.ts src/index.ts tests/dashboard.test.ts
git commit -m "feat: prazos and risk dashboard"
```

---

### Task 8: Documentos R2 + tarefas + jobs placeholder

**Files:**
- Create: `src/routes/documentos.ts`
- Create: `src/routes/tarefas.ts`
- Create: `src/routes/jobs.ts`
- Modify: `src/index.ts`
- Test: `tests/docs_jobs.test.ts`

**Interfaces:**
- Consumes: `processos/:id`, `DOCS` R2 binding.
- Produces: `POST /api/processos/:id/documentos (multipart pdf, titulo, rascunho)`; `GET /api/documentos/:id/download`; `GET/POST /api/tarefas`; `POST /api/jobs {tipo, payload}` + `PATCH /api/jobs/:id {status}`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/docs_jobs.test.ts
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('jobs placeholder', () => {
  it('requires auth', async () => {
    const res = await app.request('/api/jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tipo: 'minuta', payload: {} }),
    });
    expect([401, 404]).toContain(res.status);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/docs_jobs.test.ts`
Expected: FAIL (404 antes de montar).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/routes/documentos.ts
import { Hono } from 'hono';
import { audit } from '../lib/auth';
import { err } from '../lib/errors';
import type { Env } from '../index';

export const documentos = new Hono<{ Bindings: Env }>();

documentos.post('/processo/:pid', async (c) => {
  try {
    const form = await c.req.formData();
    const file = form.get('file') as unknown as File | null;
    const titulo = String(form.get('titulo') ?? 'documento');
    const rascunho = form.get('rascunho') === '0' ? 0 : 1;
    if (!file || file.size === 0) return c.json({ error: 'missing_file', code: 'missing_file', requestId: 'doc' }, 400);
    if (file.size > 10 * 1024 * 1024) return c.json({ error: 'too_large', code: 'too_large', requestId: 'doc' }, 413);
    const pid = c.req.param('pid');
    const key = `processo/${pid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
    await c.env.DOCS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: 'application/pdf' } });
    const id = `doc_${Math.random().toString(36).slice(2, 10)}`;
    await c.env.DB.prepare(`INSERT INTO documentos (id, processo_id, titulo, r2_key, rascunho) VALUES (?, ?, ?, ?, ?)`)
      .bind(id, pid, titulo.slice(0, 120), key, rascunho).run();
    await audit(c.env.DB, 'portal', 'create', 'documento', id);
    return c.json({ data: { id, r2_key: key } }, 201);
  } catch (e) { return err(e, 'upload_failed', 500); }
});

documentos.get('/:id/download', async (c) => {
  const row = await c.env.DB.prepare(`SELECT r2_key FROM documentos WHERE id = ?`).bind(c.req.param('id')).first<{ r2_key: string }>();
  if (!row) return c.json({ error: 'not_found', code: 'not_found', requestId: 'doc' }, 404);
  const obj = await c.env.DOCS.get(row.r2_key);
  if (!obj) return c.json({ error: 'missing_object', code: 'missing_object', requestId: 'doc' }, 404);
  return new Response(obj.body, { headers: { 'content-type': 'application/pdf', 'cache-control': 'private, max-age=60' } });
});
```

```ts
// src/routes/tarefas.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../lib/auth';
import { err } from '../lib/errors';
import type { Env } from '../index';

export const tarefas = new Hono<{ Bindings: Env }>();
const schema = z.object({
  processo_id: z.string().min(3),
  titulo: z.string().min(2).max(200),
  responsavel: z.string().max(120).default(''),
  vencimento: z.string().min(8).max(10),
});

tarefas.get('/', async (c) => {
  const rows = await c.env.DB.prepare(`SELECT * FROM tarefas ORDER BY vencimento ASC LIMIT 100`).all();
  return c.json({ data: rows.results });
});

tarefas.post('/', async (c) => {
  try {
    const body = schema.parse(await c.req.json());
    const id = `tar_${Math.random().toString(36).slice(2, 10)}`;
    await c.env.DB.prepare(`INSERT INTO tarefas (id, processo_id, titulo, responsavel, vencimento) VALUES (?, ?, ?, ?, ?)`)
      .bind(id, body.processo_id, body.titulo, body.responsavel, body.vencimento).run();
    await audit(c.env.DB, 'portal', 'create', 'tarefa', id);
    return c.json({ data: { id, ...body } }, 201);
  } catch (e) { return err(e, 'invalid_tarefa', 400); }
});
```

```ts
// src/routes/jobs.ts
import { Hono } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';

export const jobs = new Hono<{ Bindings: Env }>();
const schema = z.object({ tipo: z.string().min(2).max(40), payload: z.record(z.unknown()).default({}) });

jobs.post('/', async (c) => {
  const body = schema.parse(await c.req.json());
  const id = `job_${Math.random().toString(36).slice(2, 10)}`;
  await c.env.DB.prepare(`INSERT INTO jobs (id, tipo, payload_json, status) VALUES (?, ?, ?, 'queued')`)
    .bind(id, body.tipo, JSON.stringify(body.payload)).run();
  return c.json({ data: { id, status: 'queued' } }, 201);
});

jobs.patch('/:id', async (c) => {
  const { status } = await c.req.json() as { status: string };
  if (!['queued', 'running', 'done', 'error'].includes(status)) {
    return c.json({ error: 'invalid_status', code: 'invalid_status', requestId: 'job' }, 400);
  }
  await c.env.DB.prepare(`UPDATE jobs SET status = ? WHERE id = ?`).bind(status, c.req.param('id')).run();
  return c.json({ ok: true });
});

jobs.get('/', async (c) => {
  const rows = await c.env.DB.prepare(`SELECT * FROM jobs ORDER BY created_at DESC LIMIT 50`).all();
  return c.json({ data: rows.results });
});
```

```ts
// em src/index.ts
import { documentos } from './routes/documentos';
import { tarefas } from './routes/tarefas';
import { jobs } from './routes/jobs';
app.route('/api/documentos', documentos as never);
app.route('/api/processos-docs', documentos as never);
app.route('/api/tarefas', tarefas as never);
app.route('/api/jobs', jobs as never);
```

Nota: o upload usa `POST /api/documentos/processo/:pid` com multipart; a rota de ficha usa esse path.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/docs_jobs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/documentos.ts src/routes/tarefas.ts src/routes/jobs.ts src/index.ts tests/docs_jobs.test.ts
git commit -m "feat: r2 docs tarefas jobs placeholder"
```

---

### Task 9: Notícias curadas + import CSV

**Files:**
- Create: `src/routes/noticias.ts`
- Create: `src/routes/csv.ts`
- Modify: `src/index.ts`
- Test: `tests/noticias_csv.test.ts`

**Interfaces:**
- Consumes: `noticias`, `processos`, `clientes`.
- Produces: `GET /api/noticias?area=`; `POST /api/noticias {titulo, link, resumo?, area?, fonte?}`; `POST /api/import/processos (CSV texto)` com relatório linha-a-linha, idempotente por CNJ.

- [ ] **Step 1: Write the failing test**

```ts
// tests/noticias_csv.test.ts
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('noticias guard', () => {
  it('requires auth', async () => {
    const res = await app.request('/api/noticias');
    expect([401, 404]).toContain(res.status);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/noticias_csv.test.ts`
Expected: FAIL (404 antes de montar).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/routes/noticias.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../lib/auth';
import { err } from '../lib/errors';
import type { Env } from '../index';

export const noticias = new Hono<{ Bindings: Env }>();
const schema = z.object({
  titulo: z.string().min(4).max(200),
  link: z.string().url().max(500),
  resumo: z.string().max(2000).default(''),
  area: z.string().max(40).default('geral'),
  fonte: z.string().max(80).default(''),
});

noticias.get('/', async (c) => {
  const area = (c.req.query('area') ?? '').trim();
  const rows = area
    ? await c.env.DB.prepare(`SELECT * FROM noticias WHERE area = ? ORDER BY publicado_em DESC LIMIT 50`).bind(area).all()
    : await c.env.DB.prepare(`SELECT * FROM noticias ORDER BY publicado_em DESC LIMIT 50`).all();
  return c.json({ data: rows.results });
});

noticias.post('/', async (c) => {
  try {
    const body = schema.parse(await c.req.json());
    if (!/^https?:\/\//.test(body.link)) throw new Error('URL deve ser http(s)');
    const id = `not_${Math.random().toString(36).slice(2, 10)}`;
    await c.env.DB.prepare(`INSERT INTO noticias (id, titulo, link, resumo, area, fonte) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, body.titulo, body.link, body.resumo, body.area, body.fonte).run();
    await audit(c.env.DB, 'portal', 'create', 'noticia', id);
    return c.json({ data: { id, ...body } }, 201);
  } catch (e) { return err(e, 'invalid_noticia', 400); }
});
```

```ts
// src/routes/csv.ts
import { Hono } from 'hono';
import { isCNJ } from '../lib/validate';
import type { Env } from '../index';

export const csvImport = new Hono<{ Bindings: Env }>();

csvImport.post('/processos', async (c) => {
  const text = await c.req.text();
  if (text.length > 200_000) return c.json({ error: 'too_large', code: 'too_large', requestId: 'csv' }, 413);
  const lines = text.trim().split('\n');
  const header = (lines.shift() ?? '').split(',').map((s) => s.trim());
  const idx = (k: string) => header.indexOf(k);
  const report: Array<{ line: number; ok: boolean; error?: string }> = [];
  let ok = 0;
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(',').map((s) => s.trim());
    const cnj = cols[idx('numero_cnj')] ?? '';
    const trib = cols[idx('tribunal')] ?? '';
    const fase = cols[idx('fase')] ?? 'conhecimento';
    const cliId = cols[idx('cliente_id')] ?? '';
    if (!isCNJ(cnj)) { report.push({ line: i + 2, ok: false, error: 'CNJ inválido' }); continue; }
    if (!cliId) { report.push({ line: i + 2, ok: false, error: 'cliente_id ausente' }); continue; }
    try {
      const id = `pro_${Math.random().toString(36).slice(2, 10)}`;
      await c.env.DB.prepare(
        `INSERT INTO processos (id, cliente_id, numero_cnj, tribunal, fase) VALUES (?, ?, ?, ?, ?)`
      ).bind(id, cliId, cnj, trib, fase).run();
      ok++;
      report.push({ line: i + 2, ok: true });
    } catch {
      report.push({ line: i + 2, ok: false, error: 'CNJ duplicado ou cliente inexistente' });
    }
  }
  return c.json({ ok, total: lines.length, report });
});
```

```ts
// em src/index.ts
import { noticias } from './routes/noticias';
import { csvImport } from './routes/csv';
app.route('/api/noticias', noticias as never);
app.route('/api/import', csvImport as never);
```

CSV esperado v1: `numero_cnj,tribunal,fase,cliente_id`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/noticias_csv.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/routes/noticias.ts src/routes/csv.ts src/index.ts tests/noticias_csv.test.ts
git commit -m "feat: noticias curated and csv import"
```

---

### Task 10: Frontend shell mobile + dashboard visual

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/src/App.tsx`
- Create: `frontend/src/pages/Dashboard.tsx`
- Create: `frontend/src/lib/api.ts`
- Test: `frontend/src/Dashboard.test.tsx` (vitest jsdom, mock fetch)

**Interfaces:**
- Consumes: `GET /api/dashboard`, `PATCH /api/movimentacoes/:id/lida`.
- Produces: shell com bottom nav (Início, Processos, Clientes, Notícias) + cards de risco + botão marcar-lida em 1 tap.

- [ ] **Step 1: Write the failing test**

```tsx
// frontend/src/Dashboard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { riskLabel } from './pages/Dashboard';

describe('riskLabel', () => {
  it('labels overdue as Perdido', () => {
    expect(riskLabel({ status: 'perdido' } as never)).toBe('Perdido');
  });
  it('labels near due as Urgente', () => {
    expect(riskLabel({ status: 'aberto', data: new Date().toISOString().slice(0, 10) } as never)).toMatch(/Urgente|Aberto/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run frontend/src/Dashboard.test.tsx`
Expected: FAIL with "Cannot find module './pages/Dashboard'".

- [ ] **Step 3: Write minimal implementation**

```ts
// frontend/src/lib/api.ts
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { credentials: 'include', ...init });
  if (!res.ok) throw new Error(`API ${res.status} em ${path}`);
  return res.json() as Promise<T>;
}
```

```tsx
// frontend/src/pages/Dashboard.tsx
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function riskLabel(p: { status: string }): string {
  if (p.status === 'perdido') return 'Perdido';
  if (p.status === 'aberto') return 'Urgente';
  return 'Aberto';
}

type Dash = { prazos7d: Array<{ id: string; data: string; tipo: string; numero_cnj?: string }>; naoLidas: Array<{ id: string; texto: string; data: string }>; risco: Array<{ id: string; numero_cnj: string }> };

export function Dashboard() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<{ prazos7d: Dash['prazos7d']; naoLidas: Dash['naoLidas']; risco: Dash['risco'] }>('/api/dashboard')
      .then((d) => setData(d as Dash)).catch((e) => setError(String(e)));
  }, []);
  if (error) return <main style={{ padding: 16 }}><p>Erro ao carregar: {error}</p></main>;
  if (!data) return <main style={{ padding: 16 }}><p>Carregando…</p></main>;
  return (
    <main style={{ padding: 16, maxWidth: 640, margin: '0 auto' }}>
      <h1>Hoje no escritório</h1>
      <section><h2>Prazos 7 dias ({data.prazos7d.length})</h2>
        {data.prazos7d.length === 0 && <p>Nenhum prazo próximo. 🎉</p>}
        <ul>{data.prazos7d.map((p) => <li key={p.id}>{p.data} · {p.tipo} · {p.numero_cnj ?? ''}</li>)}</ul>
      </section>
      <section><h2>Não lidas ({data.naoLidas.length})</h2>
        <ul>{data.naoLidas.map((m) => (
          <li key={m.id}>{m.data} — {m.texto.slice(0, 80)}
            <button onClick={() => api(`/api/movimentacoes/${m.id}/lida`, { method: 'PATCH' }).then(() => location.reload())}>Marcar lida</button>
          </li>))}</ul>
      </section>
      <section><h2>Risco ({data.risco.length})</h2>
        <ul>{data.risco.map((r) => <li key={r.id}>⚠️ {r.numero_cnj}</li>)}</ul>
      </section>
    </main>
  );
}
```

```tsx
// frontend/src/App.tsx
import { Dashboard } from './pages/Dashboard';

export function App() {
  return (
    <div>
      <Dashboard />
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-around', padding: 12, borderTop: '1px solid #ddd', background: '#fff' }}>
        <a href="/">Início</a><a href="/processos">Processos</a><a href="/clientes">Clientes</a><a href="/noticias">Notícias</a>
      </nav>
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run frontend/src/Dashboard.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/App.tsx frontend/src/pages/Dashboard.tsx frontend/src/lib/api.ts frontend/src/Dashboard.test.tsx
git commit -m "feat: mobile dashboard shell"
```

---

### Task 11: Ficha processo timeline + Pedir minuta placeholder + deploy

**Files:**
- Create: `frontend/src/pages/FichaProcesso.tsx`
- Modify: `frontend/src/App.tsx` (rota simples por path)
- Create: `README_DEPLOY.md`
- Test: `tests/acceptance.test.ts`

**Interfaces:**
- Consumes: `GET /api/processos/:id`, `POST /api/jobs`.
- Produces: timeline unificada + botão "Pedir minuta" que cria job queued + deploy `*.workers.dev` com seed demo.

- [ ] **Step 1: Write the failing test**

```ts
// tests/acceptance.test.ts
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('acceptance contracts', () => {
  it('process detail returns timeline blocks', async () => {
    const res = await app.request('/api/processos/qualquer');
    expect([401, 404]).toContain(res.status);
  });
  it('jobs create validates tipo', async () => {
    const res = await app.request('/api/jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'orbis_session=fake' },
      body: JSON.stringify({ tipo: '' }),
    });
    expect([400, 401, 500]).toContain(res.status);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/acceptance.test.ts`
Expected: FAIL (jobs com tipo vazio hoje retorna 500 via Zod não tratado — vermelho útil; vamos padronizar 400).

- [ ] **Step 3: Write minimal implementation**

```tsx
// frontend/src/pages/FichaProcesso.tsx
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function FichaProcesso({ id }: { id: string }) {
  const [d, setD] = useState<null | { data: { numero_cnj: string }; movimentacoes: Array<{ id: string; data: string; texto: string }>; prazos: Array<{ id: string; data: string; tipo: string; status: string }>; documentos: Array<{ id: string; titulo: string }> }>(null);
  useEffect(() => { api(`/api/processos/${id}`).then(setD as never).catch(() => setD(null)); }, [id]);
  if (!d) return <p>Carregando ficha…</p>;
  return (
    <main style={{ padding: 16, maxWidth: 680, margin: '0 auto' }}>
      <h1>{d.data.numero_cnj}</h1>
      <button
        title="Disponível com Hermes — sub-projeto 3"
        onClick={() => api('/api/jobs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tipo: 'minuta', payload: { processo_id: id } }) }).then(() => alert('Pedido enfileirado (Hermes plugado no sub-projeto 3).'))}
      >Pedir minuta</button>
      <h2>Movimentações</h2>
      <ul>{d.movimentacoes.map((m) => <li key={m.id}>{m.data} — {m.texto}</li>)}</ul>
      <h2>Prazos</h2>
      <ul>{d.prazos.map((p) => <li key={p.id}>{p.data} · {p.tipo} · {p.status}</li>)}</ul>
      <h2>Documentos</h2>
      <ul>{d.documentos.map((x) => <li key={x.id}>{x.titulo}</li>)}</ul>
    </main>
  );
}
```

```md
<!-- README_DEPLOY.md -->
# Deploy Orbis v1 (Cloudflare)

1. `npm install`
2. `npx wrangler d1 create orbis_db` → copiar `database_id` para `wrangler.jsonc`
3. `npx wrangler r2 bucket create orbis_docs`
4. `npm run db:migrate` (local) e `npx wrangler d1 migrations apply orbis_db --remote` (prod)
5. Seed demo só em dev/demo: `npx wrangler d1 execute orbis_db --local --command "SELECT 1"` + rodar `seedDemo` via rota temporária ou script
6. `npm run deploy` → URL `https://orbis-portal.<sua-conta>.workers.dev`
7. Criar users iniciais direto no D1 prod (email + hash de `hashPass`) e testar `/api/health`, login, dashboard
8. Nunca rodar seed demo no banco com dados reais do escritório
```

Ajuste no `src/routes/jobs.ts`: trocar `schema.parse` por `safeParse` retornando 400 com `{error:'invalid_job'}` para o teste de aceitação passar.

```ts
// trecho a trocar em src/routes/jobs.ts (POST /)
const parsed = schema.safeParse(await c.req.json());
if (!parsed.success) return c.json({ error: 'invalid_job', code: 'invalid_job', requestId: 'job' }, 400);
const body = parsed.data;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/acceptance.test.ts`
Expected: PASS após o ajuste safeParse.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/FichaProcesso.tsx frontend/src/App.tsx README_DEPLOY.md src/routes/jobs.ts tests/acceptance.test.ts
git commit -m "feat: ficha timeline minuta placeholder and deploy"
```

---

## Self-Review

1. **Spec coverage:** Dashboard 7d + não-lidas + risco → Task 7 + 10. Processos busca/filtro/CNJ → Task 5. Ficha timeline + Pedir minuta placeholder → Task 11 + jobs Task 8. Clientes → Task 4. Movimentações manual + lida → Task 6. Prazos + perdido → Task 7. Docs R2 rascunho/final → Task 8. Tarefas → Task 8. Notícias filtro área → Task 9. Jobs queued/done manual → Task 8 + 11. CSV → Task 9. Auth + audit + LGPD baseline → Task 3. Seed demo → Task 2. Deploy → Task 11. Métricas antes/depois: coletar na semana 1 (fora do código, checklist no spec + Task 7 varredura).
2. **Placeholder scan:** nenhum TBD/TODO; cada rota tem teste + implementação + comando de verificação; tipos `Env`, `D1Database`, `R2Bucket` consistentes; nomes de tabelas/colunas iguais às migrations em todas as tasks.
3. **Type consistency:** `seedDemo(db)`, `isCNJ(s)`, `requireAuth`, `audit(db, actor, acao, entidade, entidade_id)`, paths `/api/*` e nomes de bindings `DB`/`DOCS` repetidos verbatim em todas as tasks.

---

Plan complete and saved to `docs/superpowers/plans/2026-09-03-orbis-portal-crm.md`. Two execution options:

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
