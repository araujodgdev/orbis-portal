// tests/onboarding.test.ts — RED: contexto do escritório + status do onboarding.
import { describe, it, expect } from 'vitest';
import app from '../src/index';

function makeDb(opts: { saved?: boolean } = {}) {
  const seen: string[] = [];
  const db = {
    prepare: (sql: string) => {
      seen.push(sql);
      return {
        bind: (..._args: unknown[]) => ({
          first: async () => {
            if (/FROM sessions/.test(sql)) return { user_id: 'u1', expires_at: '2999-01-01T00:00:00.000Z' };
            if (/FROM users/.test(sql)) return { id: 'u1', onboarding_done: opts.saved ? 1 : 0 };
            if (/FROM escritorios/.test(sql)) {
              return opts.saved ? { id: 'esc_1', nome: 'Demo Advocacia', areas: '["civel"]', tamanho_equipe: '2-5' } : null;
            }
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

const authed = { 'content-type': 'application/json', cookie: 'orbis_session=fake' };

describe('GET /api/onboarding', () => {
  it('returns pending state for fresh account', async () => {
    const { db } = makeDb();
    const res = await app.request('/api/onboarding', { headers: authed }, { DB: db });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { done: boolean; escritorio: unknown } };
    expect(body.data.done).toBe(false);
    expect(body.data.escritorio).toBeNull();
  });

  it('returns saved office context', async () => {
    const { db } = makeDb({ saved: true });
    const res = await app.request('/api/onboarding', { headers: authed }, { DB: db });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { done: boolean; escritorio: { nome: string } } };
    expect(body.data.done).toBe(true);
    expect(body.data.escritorio.nome).toBe('Demo Advocacia');
  });

  it('rejects without session', async () => {
    const { db } = makeDb();
    const res = await app.request('/api/onboarding', {}, { DB: db });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/onboarding', () => {
  it('saves office context and marks done', async () => {
    const { db, seen } = makeDb();
    const res = await app.request('/api/onboarding', {
      method: 'POST',
      headers: authed,
      body: JSON.stringify({ nome: 'Demo Advocacia', areas: ['civel', 'trabalhista'], tamanho_equipe: '2-5' }),
    }, { DB: db });
    expect(res.status).toBe(200);
    expect(seen.some((s) => /escritorios/.test(s) && /INSERT|UPDATE/.test(s))).toBe(true);
    expect(seen.some((s) => /UPDATE users SET onboarding_done/.test(s))).toBe(true);
  });

  it('returns 400 for missing office name', async () => {
    const { db } = makeDb();
    const res = await app.request('/api/onboarding', {
      method: 'POST', headers: authed, body: JSON.stringify({ areas: ['civel'] }),
    }, { DB: db });
    expect(res.status).toBe(400);
  });
});
