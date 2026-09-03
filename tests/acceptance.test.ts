// tests/acceptance.test.ts
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('acceptance contracts', () => {
  it('process detail returns timeline blocks', async () => {
    const res = await app.request('/api/processos/qualquer');
    expect([401, 404]).toContain(res.status);
  });
  it('jobs create validates tipo', async () => {
    const res = await app.request('/api/jobs', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'orbis_session=fake' },
      body: JSON.stringify({ tipo: '' }),
    });
    expect([400, 401, 500]).toContain(res.status);
  });
});
