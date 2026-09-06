// tests/signup.test.ts — RED: cadastro público com auto-login.
import { describe, it, expect } from 'vitest';
import app from '../src/index';

function makeDb(opts: { taken?: boolean } = {}) {
  const seen: string[] = [];
  const db = {
    prepare: (sql: string) => {
      seen.push(sql);
      return {
        bind: (..._args: unknown[]) => ({
          first: async () => {
            if (/FROM sessions/.test(sql)) return { user_id: 'u1', expires_at: '2999-01-01T00:00:00.000Z' };
            if (/FROM users/.test(sql)) return opts.taken ? { id: 'usr_x' } : null;
            return null;
          },
          all: async () => ({ results: [] }),
          run: async () => ({ success: true, meta: { changes: 1 } }),
        }),
      };
    },
  };
  return { db: db as never, seen };
}

const json = { 'content-type': 'application/json' };

describe('POST /api/signup', () => {
  it('creates account and logs in without prior session', async () => {
    const { db, seen } = makeDb();
    const res = await app.request('/api/signup', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email: 'novo@escritorio.com.br', pass: 'segredo123' }),
    }, { DB: db });
    expect(res.status).toBe(201);
    expect(seen.some((s) => /INSERT INTO users/.test(s))).toBe(true);
    expect(seen.some((s) => /INSERT INTO sessions/.test(s))).toBe(true);
    expect(res.headers.get('set-cookie') ?? '').toContain('orbis_session=');
  });

  it('returns 409 for email already in use', async () => {
    const { db } = makeDb({ taken: true });
    const res = await app.request('/api/signup', {
      method: 'POST',
      headers: json,
      body: JSON.stringify({ email: 'usado@escritorio.com.br', pass: 'segredo123' }),
    }, { DB: db });
    expect(res.status).toBe(409);
  });

  it('returns 400 for invalid email and short pass', async () => {
    const { db } = makeDb();
    for (const body of [{ email: 'sem-arroba', pass: 'segredo123' }, { email: 'a@b.com.br', pass: 'curta' }]) {
      const res = await app.request('/api/signup', {
        method: 'POST', headers: json, body: JSON.stringify(body),
      }, { DB: db });
      expect(res.status).toBe(400);
    }
  });
});
