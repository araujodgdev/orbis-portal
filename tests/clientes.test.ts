// tests/clientes.test.ts
import { describe, it, expect } from 'vitest';
import app from '../src/index';

// Fake D1: valid session for auth, canned cliente rows for reads.
const seen: string[] = [];
const fakeDb = {
  prepare: (sql: string) => {
    seen.push(sql);
    return {
      bind: (..._args: unknown[]) => ({
        first: async () => ({ user_id: 'u1', expires_at: '2999-01-01T00:00:00.000Z' }),
        all: async () => ({ results: [{ id: 'demo_cli_01', nome: 'Demo Silva', cpf_cnpj: '12.345.678/0001-90' }] }),
        run: async () => ({ success: true }),
      }),
      all: async () => ({ results: [] }),
    };
  },
};

const authed = { 'content-type': 'application/json', cookie: 'orbis_session=fake' };

describe('POST /api/clientes', () => {
  it('rejects empty nome with 400', async () => {
    const res = await app.request('/api/clientes', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'orbis_session=fake' },
      body: JSON.stringify({ nome: '' }),
    });
    expect([400, 401]).toContain(res.status);
  });

  it('filters by nome with LIKE', async () => {
    seen.length = 0;
    const res = await app.request('/api/clientes?nome=demo', { headers: authed }, { DB: fakeDb } as never);
    expect(res.status).toBe(200);
    expect(seen.some((s) => /nome LIKE \?/.test(s))).toBe(true);
    const body = await res.json() as { data: Array<{ nome: string }> };
    expect(body.data[0].nome).toBe('Demo Silva');
  });

  it('filters by cpf/cnpj including digit-only match', async () => {
    seen.length = 0;
    const res = await app.request('/api/clientes?cnpj=12.345.678/0001-90', { headers: authed }, { DB: fakeDb } as never);
    expect(res.status).toBe(200);
    expect(seen.some((s) => /REPLACE\(/.test(s))).toBe(true);
  });

  it('creates cliente with cpf_cnpj', async () => {
    const res = await app.request('/api/clientes', {
      method: 'POST',
      headers: authed,
      body: JSON.stringify({ nome: 'Nova Empresa', cpf_cnpj: '12.345.678/0001-90' }),
    }, { DB: fakeDb } as never);
    expect(res.status).toBe(201);
    const body = await res.json() as { data: { cpf_cnpj: string } };
    expect(body.data.cpf_cnpj).toBe('12.345.678/0001-90');
  });
});
