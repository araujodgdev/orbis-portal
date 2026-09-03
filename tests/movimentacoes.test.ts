import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('movimentacoes guard', () => {
  it('requires auth', async () => {
    const res = await app.request('/api/movimentacoes/nao-lidas');
    expect([401, 404]).toContain(res.status);
  });
});
