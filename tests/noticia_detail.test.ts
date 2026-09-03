// tests/noticia_detail.test.ts
import { describe, it, expect } from 'vitest';
import app from '../src/index';

const row = {
  id: 'demo_not_01',
  titulo: 'STJ fixa tese sobre honorários',
  link: 'https://example.test/stj',
  resumo: 'Resumo curado v1.',
  area: 'civel',
  fonte: 'Jusbrasil',
};

function dbWith(noticia: unknown) {
  return {
    prepare: (sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: async () =>
          /FROM sessions/i.test(sql)
            ? { user_id: 'u1', expires_at: '2999-01-01T00:00:00.000Z' }
            : /FROM noticias/i.test(sql)
              ? noticia
              : null,
        all: async () => ({ results: [] }),
        run: async () => ({ success: true }),
      }),
    }),
  };
}

const authed = { cookie: 'orbis_session=fake' };

describe('GET /api/noticias/:id', () => {
  it('returns the noticia', async () => {
    const res = await app.request('/api/noticias/demo_not_01', { headers: authed }, { DB: dbWith(row) } as never);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: { titulo: string } };
    expect(body.data.titulo).toBe('STJ fixa tese sobre honorários');
  });

  it('returns 404 for unknown id', async () => {
    const res = await app.request('/api/noticias/nope', { headers: authed }, { DB: dbWith(null) } as never);
    expect(res.status).toBe(404);
  });

  it('requires auth', async () => {
    const res = await app.request('/api/noticias/demo_not_01');
    expect(res.status).toBe(401);
  });
});
