// tests/docs_jobs.test.ts
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('jobs placeholder', () => {
  it('requires auth', async () => {
    const res = await app.request('/api/jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ tipo: 'minuta', payload: {} }),
    });
    expect([401, 404]).toContain(res.status);
  });
});
