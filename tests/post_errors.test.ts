// tests/post_errors.test.ts
import { describe, it, expect } from 'vitest';
import app from '../src/index';

// Auth passes (valid session row), but every write prepare throws:
// proves non-validation failures in POST handlers surface 5xx,
// while Zod validation failures still return their 400 invalid_* shape.
const fakeDb = {
  prepare: (sql: string) => ({
    bind: (..._args: unknown[]) => ({
      first: async () =>
        /FROM sessions/i.test(sql)
          ? { user_id: 'u1', expires_at: '2999-01-01T00:00:00.000Z' }
          : null,
      run: async () => {
        if (/^INSERT/i.test(sql.trim())) throw new Error('boom');
        return { success: true };
      },
    }),
  }),
};

const authed = { 'content-type': 'application/json', cookie: 'orbis_session=fake' };

describe('POST error mapping', () => {
  it('DB failure on valid prazo input surfaces 5xx', async () => {
    const res = await app.request(
      '/api/prazos/processo/pro_123',
      {
        method: 'POST',
        headers: authed,
        body: JSON.stringify({ data: '2026-09-10', tipo: 'manifestacao' }),
      },
      { DB: fakeDb } as never,
    );
    expect(res.status).toBe(500);
  });
  it('invalid prazo input still returns 400 invalid_prazo', async () => {
    const res = await app.request(
      '/api/prazos/processo/pro_123',
      {
        method: 'POST',
        headers: authed,
        body: JSON.stringify({ data: 'qualquer', tipo: 'manifestacao' }),
      },
      { DB: fakeDb } as never,
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string; code: string };
    expect(body.code).toBe('invalid_prazo');
  });
});
