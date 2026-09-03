import { describe, it, expect } from 'vitest';
import app from '../src/index';

function makeDb() {
  const seen: string[] = [];
  const db = {
    prepare: (sql: string) => {
      seen.push(sql);
      return {
        bind: (..._args: unknown[]) => ({
          first: async () => {
            if (/FROM sessions/.test(sql)) return { user_id: 'u1', expires_at: '2999-01-01T00:00:00.000Z' };
            return null;
          },
          all: async () => ({ results: [] }),
          run: async () => ({ success: true }),
        }),
      };
    },
  };
  return { db: db as never, seen };
}
const authed = { 'content-type': 'application/json', cookie: 'orbis_session=fake' };

describe('POST /api/tokens', () => {
  it('creates token and shows value once', async () => {
    const { db, seen } = makeDb();
    const res = await app.request('/api/tokens', {
      method: 'POST', headers: authed, body: JSON.stringify({ nome: 'claude-code' }),
    }, { DB: db });
    expect(res.status).toBe(201);
    expect(seen.some((s) => /INSERT INTO api_tokens/.test(s))).toBe(true);
    const body = await res.json() as { token: string };
    expect(body.token.startsWith('orbis_')).toBe(true);
  });
  it('rejects without session', async () => {
    const { db } = makeDb();
    const res = await app.request('/api/tokens', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({}),
    }, { DB: db });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/tokens', () => {
  it('lists without exposing hashes', async () => {
    const { db } = makeDb();
    const res = await app.request('/api/tokens', { headers: authed }, { DB: db });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(/token_hash/.test(text)).toBe(false);
  });
});

describe('DELETE /api/tokens/:id', () => {
  it('revokes instead of deleting', async () => {
    const { db, seen } = makeDb();
    const res = await app.request('/api/tokens/tok_1', { method: 'DELETE', headers: authed }, { DB: db });
    expect(res.status).toBe(200);
    expect(seen.some((s) => /UPDATE api_tokens SET revogado_em/.test(s))).toBe(true);
  });
});
