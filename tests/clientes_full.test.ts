// tests/clientes_full.test.ts — RED: ficha completa do cliente.
import { describe, it, expect } from 'vitest';
import app from '../src/index';

function makeDb() {
  const seen: string[] = [];
  const db = {
    prepare: (sql: string) => {
      seen.push(sql);
      return {
        bind: (...args: unknown[]) => ({
          first: async () => {
            if (/FROM sessions/.test(sql)) return { user_id: 'u1', expires_at: '2999-01-01T00:00:00.000Z' };
            if (/^SELECT/i.test(sql)) return { id: args[args.length - 1], nome: 'Demo' };
            return null;
          },
          all: async () => ({ results: [] }),
          run: async () => ({ success: true, meta: { changes: 1 } }),
        }),
        all: async () => ({ results: [] }),
      };
    },
  };
  return { db: db as never, seen };
}

const authed = { 'content-type': 'application/json', cookie: 'orbis_session=fake' };
const full = {
  nome: 'Silva & Prado',
  tipo: 'pj',
  cpf_cnpj: '12.345.678/0001-90',
  doc_extra: 'IE 123456',
  email: 'contato@silvaprado.com.br',
  telefone: '(11) 99999-0000',
  endereco: 'Av. Paulista 1000, São Paulo/SP',
  observacoes: 'Cliente desde 2020.',
  honorario_status: 'em dia',
  honorario_valor: 150000,
  honorario_vencimento: '10',
  honorario_forma: 'mensal',
};

describe('POST /api/clientes ficha completa', () => {
  it('creates with all fields', async () => {
    const { db, seen } = makeDb();
    const res = await app.request('/api/clientes', {
      method: 'POST', headers: authed, body: JSON.stringify(full),
    }, { DB: db });
    expect(res.status).toBe(201);
    expect(seen.some((s) => /INSERT INTO clientes/.test(s))).toBe(true);
    const body = await res.json() as { data: typeof full };
    expect(body.data.email).toBe('contato@silvaprado.com.br');
    expect(body.data.honorario_valor).toBe(150000);
  });

  it('applies defaults on minimal body', async () => {
    const { db } = makeDb();
    const res = await app.request('/api/clientes', {
      method: 'POST', headers: authed, body: JSON.stringify({ nome: 'Só Nome' }),
    }, { DB: db });
    expect(res.status).toBe(201);
    const body = await res.json() as { data: { tipo: string; honorario_status: string; honorario_forma: string } };
    expect(body.data.tipo).toBe('pf');
    expect(body.data.honorario_status).toBe('em dia');
  });

  it('returns 400 for invalid tipo, email and valor', async () => {
    const { db } = makeDb();
    for (const body of [
      { ...full, tipo: 'xx' },
      { ...full, email: 'sem-arroba' },
      { ...full, honorario_valor: -5 },
      { ...full, honorario_status: 'desconhecido' },
    ]) {
      const res = await app.request('/api/clientes', {
        method: 'POST', headers: authed, body: JSON.stringify(body),
      }, { DB: db });
      expect(res.status).toBe(400);
    }
  });
});

describe('PATCH /api/clientes ficha completa', () => {
  it('updates contact and honorario fields', async () => {
    const { db, seen } = makeDb();
    const res = await app.request('/api/clientes/cli_1', {
      method: 'PATCH', headers: authed,
      body: JSON.stringify({ telefone: '(11) 98888-1111', honorario_status: 'atrasado', honorario_valor: 200000 }),
    }, { DB: db });
    expect(res.status).toBe(200);
    expect(seen.some((s) => /UPDATE clientes SET/.test(s))).toBe(true);
    const body = await res.json() as { data: { honorario_status: string } };
    expect(body.data.honorario_status).toBe('atrasado');
  });

  it('returns 400 for invalid honorario_status', async () => {
    const { db } = makeDb();
    const res = await app.request('/api/clientes/cli_1', {
      method: 'PATCH', headers: authed, body: JSON.stringify({ nome: 'Nome Válido', honorario_status: 'ativo' }),
    }, { DB: db });
    expect(res.status).toBe(400);
  });
});
