// tests/auth.test.ts
import { describe, it, expect } from 'vitest';
import app from '../src/index';

// Plain vitest has no D1 binding; minimal fake so the login handler
// reaches the credential check (returns null user -> 401).
const fakeDb = {
  prepare: (_sql: string) => ({
    bind: (..._args: unknown[]) => ({
      first: async () => null,
      run: async () => ({ success: true }),
    }),
  }),
};

describe('auth v1', () => {
  it('rejects /api/clientes without session', async () => {
    const res = await app.request('/api/clientes');
    expect([401, 404]).toContain(res.status);
  });
  it('login with wrong pass returns 401', async () => {
    const res = await app.request(
      '/api/login',
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: 'x@y.test', pass: 'wrong' }),
      },
      { DB: fakeDb } as never,
    );
    expect(res.status).toBe(401);
  });
});
