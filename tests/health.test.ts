import { describe, it, expect } from 'vitest';
import app from '../src/index';

describe('GET /api/health', () => {
  it('returns ok with requestId', async () => {
    const res = await app.request('/api/health');
    expect(res.status).toBe(200);
    const body = await res.json() as { ok: boolean; requestId: string };
    expect(body.ok).toBe(true);
    expect(typeof body.requestId).toBe('string');
  });
});
