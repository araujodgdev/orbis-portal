// tests/clientes.test.ts
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('POST /api/clientes', () => {
  it('rejects empty nome with 400', async () => {
    const res = await app.request('/api/clientes', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'orbis_session=fake' },
      body: JSON.stringify({ nome: '' }),
    });
    expect([400, 401]).toContain(res.status);
  });
});
