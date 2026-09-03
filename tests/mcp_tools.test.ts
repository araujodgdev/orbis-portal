import { describe, it, expect } from 'vitest';
import app from '../src/index';

function makeDb(opts: { processos?: unknown[]; cliente?: unknown } = {}) {
  const db = {
    prepare: (sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: async () => {
          if (/FROM api_tokens/.test(sql)) return { user_id: 'u1' };
          if (/FROM clientes/.test(sql)) return opts.cliente ?? null;
          return null;
        },
        all: async () => {
          if (/FROM processos/.test(sql)) return { results: opts.processos ?? [] };
          return { results: [] };
        },
        run: async () => ({ success: true }),
      }),
    }),
  };
  return db as never;
}

async function rpc(db: never, body: unknown, token = 'Bearer orbis_test') {
  const res = await app.request('/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: token },
    body: JSON.stringify(body),
  }, { DB: db });
  const text = await res.text();
  const line = text.split('\n').find((l) => l.startsWith('data: ')) ?? '';
  return { status: res.status, json: (line ? JSON.parse(line.slice(6)) : null) as any };
}

describe('MCP read tools', () => {
  it('search_processos returns matching rows', async () => {
    const dbComProcessos = makeDb({ processos: [{ id: 'pro_1', numero_cnj: '0000000-00.0000.0.00.0000' }] });
    const { json } = await rpc(dbComProcessos, { jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'search_processos', arguments: { q: '0000' } } });
    const text = json.result.content[0].text as string;
    expect(text).toContain('pro_1');
  });
  it('get_cliente unknown id returns readable error', async () => {
    const dbVazio = makeDb();
    const { json } = await rpc(dbVazio, { jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: { name: 'get_cliente', arguments: { id: 'missing_1' } } });
    expect(json.result.isError).toBe(true);
    const text = json.result.content[0].text as string;
    expect(text).toMatch(/não encontrado/i);
  });
  it('tools/list exposes the 7 read tools', async () => {
    const { json } = await rpc(makeDb(), { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    const names = json.result?.tools.map((t) => t.name) ?? [];
    for (const n of ['search_processos', 'get_processo', 'search_clientes', 'get_cliente', 'list_prazos', 'list_tarefas', 'get_dashboard']) {
      expect(names).toContain(n);
    }
  });
});

describe('MCP write tools', () => {
  const dbComFilhos = {
    prepare: (sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: async () => {
          if (/FROM api_tokens/.test(sql)) return { user_id: 'u1' };
          if (/COUNT\(\*\)/.test(sql)) return { n: 2 };
          if (/FROM clientes/.test(sql)) return { id: 'cli_1' };
          return null;
        },
        all: async () => ({ results: [] }),
        run: async () => ({ success: true }),
      }),
    }),
  } as never;

  it('create_cliente validates email', async () => {
    const { json } = await rpc(makeDb(), { jsonrpc: '2.0', id: 4, method: 'tools/call',
      params: { name: 'create_cliente', arguments: { nome: 'X', email: 'sem-arroba' } } });
    expect(json.result.isError).toBe(true);
  });
  it('delete_cliente with processos is blocked', async () => {
    // fakeDb: COUNT(*) → { n: 2 }
    const { json } = await rpc(dbComFilhos, { jsonrpc: '2.0', id: 5, method: 'tools/call',
      params: { name: 'delete_cliente', arguments: { id: 'cli_1' } } });
    expect(json.result.isError).toBe(true);
    const text = json.result.content[0].text as string;
    expect(text).toMatch(/processos vinculados/i);
  });
  it('update_prazo_status with unknown id returns not-found error', async () => {
    // makeDb: SELECT id FROM prazos → first() null (só clientes/api_tokens retornam linha)
    const { json } = await rpc(makeDb(), { jsonrpc: '2.0', id: 6, method: 'tools/call',
      params: { name: 'update_prazo_status', arguments: { id: 'prz_missing', status: 'cumprido' } } });
    expect(json.result.isError).toBe(true);
    const text = json.result.content[0].text as string;
    expect(text).toMatch(/não encontrado/i);
  });
  it('tools/list totals 16 tools', async () => {
    const { json } = await rpc(makeDb(), { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(json.result?.tools.length).toBe(16);
  });
});
