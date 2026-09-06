// tests/crud.test.ts — RED: update/delete/list que ainda não existem nas rotas.
import { describe, it, expect } from 'vitest';
import app from '../src/index';

// Fake D1 com sessão válida; `found` controla SELECT por id, `kids` o COUNT de filhos.
function makeDb(opts: { found?: boolean; kids?: number } = {}) {
  const { found = true, kids = 0 } = opts;
  const seen: string[] = [];
  const db = {
    prepare: (sql: string) => {
      seen.push(sql);
      return {
        bind: (...args: unknown[]) => ({
          first: async () => {
            if (/FROM sessions/.test(sql)) return { user_id: 'u1', expires_at: '2999-01-01T00:00:00.000Z' };
            if (/COUNT\(\*\)/i.test(sql)) return { n: kids };
            if (/^SELECT/i.test(sql)) return found ? { id: args[args.length - 1], nome: 'Demo', status: 'ativo' } : null;
            return null;
          },
          all: async () => ({
            results: found ? [{ id: 'prz_1', processo_id: 'pro_1', data: '2999-06-01', tipo: 'manifestacao', status: 'aberto' }] : [],
          }),
          run: async () => ({ success: true, meta: { changes: found ? 1 : 0 } }),
        }),
        all: async () => ({ results: [] }),
      };
    },
  };
  return { db: db as never, seen };
}

const authed = { 'content-type': 'application/json', cookie: 'orbis_session=fake' };

describe('PATCH /api/clientes/:id', () => {
  it('updates nome and returns merged row', async () => {
    const { db, seen } = makeDb();
    const res = await app.request('/api/clientes/cli_1', {
      method: 'PATCH', headers: authed, body: JSON.stringify({ nome: 'Novo Nome' }),
    }, { DB: db });
    expect(res.status).toBe(200);
    expect(seen.some((s) => /UPDATE clientes SET/.test(s))).toBe(true);
    const body = await res.json() as { data: { nome: string } };
    expect(body.data.nome).toBe('Novo Nome');
  });

  it('returns 404 for unknown id', async () => {
    const { db, seen } = makeDb({ found: false });
    const res = await app.request('/api/clientes/missing_1', {
      method: 'PATCH', headers: authed, body: JSON.stringify({ nome: 'Nome X' }),
    }, { DB: db });
    expect(res.status).toBe(404);
    expect(seen.some((s) => /FROM clientes/.test(s))).toBe(true);
  });

  it('returns 400 for invalid fields', async () => {
    const { db } = makeDb();
    const res = await app.request('/api/clientes/cli_1', {
      method: 'PATCH', headers: authed, body: JSON.stringify({ nome: '' }),
    }, { DB: db });
    expect(res.status).toBe(400);
  });
});

describe('PATCH /api/processos/:id', () => {
  it('archives processo via status', async () => {
    const { db, seen } = makeDb();
    const res = await app.request('/api/processos/pro_1', {
      method: 'PATCH', headers: authed, body: JSON.stringify({ status: 'arquivado' }),
    }, { DB: db });
    expect(res.status).toBe(200);
    expect(seen.some((s) => /UPDATE processos SET/.test(s))).toBe(true);
  });

  it('returns 400 for unknown status', async () => {
    const { db } = makeDb();
    const res = await app.request('/api/processos/pro_1', {
      method: 'PATCH', headers: authed, body: JSON.stringify({ status: 'sumido' }),
    }, { DB: db });
    expect(res.status).toBe(400);
  });

  it('returns 404 for unknown id', async () => {
    const { db, seen } = makeDb({ found: false });
    const res = await app.request('/api/processos/missing_1', {
      method: 'PATCH', headers: authed, body: JSON.stringify({ fase: 'execucao' }),
    }, { DB: db });
    expect(res.status).toBe(404);
    expect(seen.some((s) => /FROM processos/.test(s))).toBe(true);
  });
});

describe('PATCH /api/tarefas/:id', () => {
  it('concludes tarefa via status', async () => {
    const { db, seen } = makeDb();
    const res = await app.request('/api/tarefas/tar_1', {
      method: 'PATCH', headers: authed, body: JSON.stringify({ status: 'concluida' }),
    }, { DB: db });
    expect(res.status).toBe(200);
    expect(seen.some((s) => /UPDATE tarefas SET/.test(s))).toBe(true);
  });

  it('returns 404 for unknown id', async () => {
    const { db, seen } = makeDb({ found: false });
    const res = await app.request('/api/tarefas/missing_1', {
      method: 'PATCH', headers: authed, body: JSON.stringify({ titulo: 'Titulo X' }),
    }, { DB: db });
    expect(res.status).toBe(404);
    expect(seen.some((s) => /FROM tarefas/.test(s))).toBe(true);
  });
});

describe('DELETE /api/clientes/:id', () => {
  it('deletes cliente without processos', async () => {
    const { db, seen } = makeDb({ kids: 0 });
    const res = await app.request('/api/clientes/cli_1', {
      method: 'DELETE', headers: authed,
    }, { DB: db });
    expect(res.status).toBe(200);
    expect(seen.some((s) => /DELETE FROM clientes/.test(s))).toBe(true);
  });

  it('returns 409 when cliente has processos', async () => {
    const { db } = makeDb({ kids: 2 });
    const res = await app.request('/api/clientes/cli_1', {
      method: 'DELETE', headers: authed,
    }, { DB: db });
    expect(res.status).toBe(409);
  });

  it('returns 404 for unknown id', async () => {
    const { db, seen } = makeDb({ found: false });
    const res = await app.request('/api/clientes/missing_1', {
      method: 'DELETE', headers: authed,
    }, { DB: db });
    expect(res.status).toBe(404);
    expect(seen.some((s) => /FROM clientes/.test(s))).toBe(true);
  });
});

describe('DELETE /api/tarefas/:id', () => {
  it('deletes tarefa', async () => {
    const { db, seen } = makeDb();
    const res = await app.request('/api/tarefas/tar_1', {
      method: 'DELETE', headers: authed,
    }, { DB: db });
    expect(res.status).toBe(200);
    expect(seen.some((s) => /DELETE FROM tarefas/.test(s))).toBe(true);
  });

  it('returns 404 for unknown id', async () => {
    const { db, seen } = makeDb({ found: false });
    const res = await app.request('/api/tarefas/missing_1', {
      method: 'DELETE', headers: authed,
    }, { DB: db });
    expect(res.status).toBe(404);
    expect(seen.some((s) => /FROM tarefas/.test(s))).toBe(true);
  });
});

describe('GET /api/prazos', () => {
  it('lists prazos filtered by status', async () => {
    const { db, seen } = makeDb();
    const res = await app.request('/api/prazos?status=aberto', { headers: authed }, { DB: db });
    expect(res.status).toBe(200);
    expect(seen.some((s) => /FROM prazos/.test(s) && /status/.test(s))).toBe(true);
    const body = await res.json() as { data: unknown[] };
    expect(body.data.length).toBe(1);
  });

  it('returns 400 for unknown status filter', async () => {
    const { db } = makeDb();
    const res = await app.request('/api/prazos?status=sumido', { headers: authed }, { DB: db });
    expect(res.status).toBe(400);
  });
});
