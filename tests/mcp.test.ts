import { describe, it, expect } from 'vitest';
import app from '../src/index';

function makeDb(opts: { valid?: boolean } = {}) {
  const db = {
    prepare: (sql: string) => ({
      bind: (..._args: unknown[]) => ({
        first: async () => {
          if (/FROM api_tokens/.test(sql)) return opts.valid === false ? null : { user_id: 'u1' };
          if (/FROM sessions/.test(sql)) return { user_id: 'u1', expires_at: '2999-01-01T00:00:00.000Z' };
          return null;
        },
        all: async () => ({ results: [] }),
        run: async () => ({ success: true }),
      }),
    }),
  };
  return db as never;
}

async function rpc(db: never, body: unknown, token = 'Bearer orbis_test') {
  const res = await app.request('/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: token },
    body: JSON.stringify(body),
  }, { DB: db });
  const text = await res.text();
  const line = text.split('\n').find((l) => l.startsWith('data: ')) ?? '';
  // 401 (sem SSE) → json null; o teste relevante só verifica o status.
  return { status: res.status, json: (line ? JSON.parse(line.slice(6)) : null) as { result?: { tools: Array<{ name: string }> }, error?: unknown } | null };
}

describe('POST /mcp', () => {
  it('lists registered tools with valid token', async () => {
    const { json } = await rpc(makeDb(), { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(json?.result?.tools.length).toBe(0);
  });
  it('rejects without token', async () => {
    const res = await app.request('/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    }, { DB: makeDb() });
    expect(res.status).toBe(401);
  });
  it('rejects revoked token', async () => {
    const { status } = await rpc(makeDb({ valid: false }), { jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(status).toBe(401);
  });
  it('rejects cookie session on /mcp', async () => {
    const res = await app.request('/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: 'orbis_session=fake' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    }, { DB: makeDb() });
    expect(res.status).toBe(401);
  });
  it('returns 405 for GET', async () => {
    const res = await app.request('/mcp', { headers: { authorization: 'Bearer orbis_test' } }, { DB: makeDb() });
    expect(res.status).toBe(405);
  });
});
