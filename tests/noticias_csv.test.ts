// tests/noticias_csv.test.ts
import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('noticias guard', () => {
  it('requires auth', async () => {
    const res = await app.request('/api/noticias');
    expect([401, 404]).toContain(res.status);
  });
});
