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

describe('MCP final review wave', () => {
  function makeCaptureDb(opts: {
    cliente?: unknown; processo?: unknown; movs?: unknown[]; prazos?: unknown[];
    docs?: unknown[]; processos?: unknown[]; clientes?: unknown[];
    count?: number; auditThrows?: boolean;
  } = {}) {
    const seen: { sql: string; args: unknown[] }[] = [];
    const all = async (sql: string) => {
      if (/FROM movimentacoes/.test(sql)) return { results: opts.movs ?? [] };
      if (/FROM prazos/.test(sql)) return { results: opts.prazos ?? [] };
      if (/FROM documentos/.test(sql)) return { results: opts.docs ?? [] };
      if (/FROM processos/.test(sql)) return { results: opts.processos ?? [] };
      if (/FROM clientes/.test(sql)) return { results: opts.clientes ?? [] };
      return { results: [] };
    };
    const db = {
      prepare: (sql: string) => ({
        bind: (...args: unknown[]) => {
          seen.push({ sql, args });
          return {
            first: async () => {
              if (/FROM api_tokens/.test(sql)) return { user_id: 'u1' };
              if (/COUNT\(\*\)/.test(sql)) return { n: opts.count ?? 0 };
              if (/FROM clientes/.test(sql)) return opts.cliente ?? null;
              if (/FROM processos/.test(sql)) return opts.processo ?? null;
              return null;
            },
            all: () => all(sql),
            run: async () => {
              if (/INSERT INTO audit_logs/.test(sql) && opts.auditThrows) throw new Error('D1 caiu');
              return { success: true };
            },
          };
        },
      }),
    };
    return { db: db as never, seen };
  }

  async function call(db: never, name: string, args: unknown, id = 1) {
    return rpc(db, { jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } });
  }

  it('list_prazos with no filters returns rows (empty-bind path)', async () => {
    const { db, seen } = makeCaptureDb({ prazos: [{ id: 'prz_1' }] });
    const { json } = await call(db, 'list_prazos', {});
    expect(json.result.isError).not.toBe(true);
    expect(json.result.content[0].text as string).toContain('prz_1');
    const sel = seen.find((s) => /SELECT \* FROM prazos/.test(s.sql));
    expect(sel?.args.length).toBe(0);
  });

  it('get_processo unknown id returns readable error', async () => {
    const { db } = makeCaptureDb();
    const { json } = await call(db, 'get_processo', { id: 'missing_1' });
    expect(json.result.isError).toBe(true);
    expect(json.result.content[0].text as string).toMatch(/não encontrado/i);
  });

  it('get_processo returns ficha completa (data + movimentacoes + prazos + documentos)', async () => {
    const { db } = makeCaptureDb({
      processo: { id: 'pro_1' }, movs: [{ id: 'mov_1' }], prazos: [{ id: 'prz_1' }], docs: [{ id: 'doc_1' }],
    });
    const { json } = await call(db, 'get_processo', { id: 'pro_1' });
    expect(json.result.isError).not.toBe(true);
    const body = JSON.parse(json.result.content[0].text as string) as Record<string, unknown>;
    expect((body.data as { id: string }).id).toBe('pro_1');
    expect(body.movimentacoes).toEqual([{ id: 'mov_1' }]);
    expect(body.prazos).toEqual([{ id: 'prz_1' }]);
    expect(body.documentos).toEqual([{ id: 'doc_1' }]);
  });

  it('search_clientes filters by cnpj with digit normalization', async () => {
    const { db, seen } = makeCaptureDb({ clientes: [{ id: 'cli_1' }] });
    const { json } = await call(db, 'search_clientes', { cnpj: '12.345.678/0001-90' });
    expect(json.result.isError).not.toBe(true);
    expect(json.result.content[0].text as string).toContain('cli_1');
    const sel = seen.find((s) => /SELECT \* FROM clientes/.test(s.sql));
    expect(sel?.sql).toContain('cpf_cnpj');
    expect(sel?.args).toContain('%12.345.678/0001-90%');
    expect(sel?.args).toContain('%12345678000190%');
  });

  it('search_processos escapes LIKE wildcards', async () => {
    const { db, seen } = makeCaptureDb({ processos: [] });
    await call(db, 'search_processos', { q: '100%_x' });
    const sel = seen.find((s) => /FROM processos p JOIN/.test(s.sql));
    expect(sel?.sql).toContain(`ESCAPE '\\'`);
    expect(sel?.args).toEqual(['%100\\%\\_x%', '%100\\%\\_x%']);
  });

  it('update_cliente/update_processo/update_tarefa with empty body return readable error', async () => {
    const { db } = makeCaptureDb({ cliente: { id: 'cli_1' }, processo: { id: 'pro_1' } });
    for (const [name, args] of [
      ['update_cliente', { id: 'cli_1' }],
      ['update_processo', { id: 'pro_1' }],
      ['update_tarefa', { id: 'tar_1' }],
    ] as const) {
      const { json } = await call(db, name, args);
      expect(json.result.isError).toBe(true);
      expect(json.result.content[0].text as string).toMatch(/nada para atualizar/i);
    }
  });

  it('delete_cliente success path', async () => {
    const { db, seen } = makeCaptureDb({ cliente: { id: 'cli_1' }, count: 0 });
    const { json } = await call(db, 'delete_cliente', { id: 'cli_1' });
    expect(json.result.isError).not.toBe(true);
    expect(JSON.parse(json.result.content[0].text as string)).toEqual({ ok: true });
    expect(seen.some((s) => /DELETE FROM clientes/.test(s.sql))).toBe(true);
  });

  it('tools/call writes audit_logs with mcp.<tool> action and {tool, args} meta', async () => {
    const { db, seen } = makeCaptureDb({ processos: [] });
    await call(db, 'search_processos', { q: '0000' });
    const ins = seen.find((s) => /INSERT INTO audit_logs/.test(s.sql));
    expect(ins).toBeDefined();
    expect(ins?.args[2]).toBe('mcp.search_processos');
    expect(JSON.parse(String(ins?.args[5]))).toEqual({ tool: 'search_processos', args: { q: '0000' } });
  });

  it('audit failure still returns success', async () => {
    const { db } = makeCaptureDb({ cliente: { id: 'cli_1', nome: 'Ada' }, auditThrows: true });
    const { json } = await call(db, 'get_cliente', { id: 'cli_1' });
    expect(json.result.isError).not.toBe(true);
    expect(json.result.content[0].text as string).toContain('cli_1');
  });
});
