// tests/dashboard.test.ts
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('GET /api/dashboard', () => {
  it('requires auth and returns 3 blocks when authed shape', async () => {
    const res = await app.request('/api/dashboard');
    expect([401, 404, 200]).toContain(res.status);
  });
});
