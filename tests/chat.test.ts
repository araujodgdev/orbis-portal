import { describe, it, expect } from 'vitest';
import app from '../src/index';

type Row = Record<string, unknown>;
export function makeChatDb(opts: {
  sessionOwner?: Row | null;
  sessionList?: Row[];
  tokenUser?: Row | null;
  messages?: Row[];
  outbox?: Row[];
  changes?: number;
} = {}) {
  const seen: string[] = [];
  const db = {
    prepare: (sql: string) => {
      seen.push(sql);
      return {
        bind: (..._args: unknown[]) => ({
          first: async () => {
            if (/FROM chat_sessions/.test(sql)) {
              if (opts.sessionOwner !== undefined) return opts.sessionOwner;
              return { id: 'cht_1', user_id: 'u1' };
            }
            if (/FROM api_tokens/.test(sql)) return opts.tokenUser !== undefined ? opts.tokenUser : null;
            if (/FROM sessions/.test(sql)) return { user_id: 'u1', expires_at: '2999-01-01T00:00:00.000Z' };
            return null;
          },
          all: async () => {
            if (/FROM chat_sessions/.test(sql)) return { results: opts.sessionList ?? [] };
            if (/FROM chat_messages/.test(sql)) {
              if (/estado/.test(sql)) return { results: opts.outbox ?? [] };
              return { results: opts.messages ?? [] };
            }
            return { results: [] };
          },
          run: async () => ({ success: true, meta: { changes: opts.changes ?? 1 } }),
        }),
      };
    },
  };
  return { db: db as never, seen };
}
const authed = { 'content-type': 'application/json', cookie: 'orbis_session=fake' };

describe('GET /api/chat/sessions', () => {
  it('lists own sessions in order', async () => {
    const { db, seen } = makeChatDb({ sessionList: [{ id: 'cht_1', titulo: 'Chat', updated_at: '2026-09-04' }] });
    const res = await app.request('/api/chat/sessions', { headers: authed }, { DB: db });
    expect(res.status).toBe(200);
    expect(seen.some((s) => /FROM chat_sessions.*WHERE user_id/.test(s))).toBe(true);
    const body = await res.json() as { data: { id: string }[] };
    expect(body.data[0].id).toBe('cht_1');
  });
  it('rejects without session', async () => {
    const { db } = makeChatDb();
    const res = await app.request('/api/chat/sessions', {}, { DB: db });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/chat/sessions/:id/messages', () => {
  it('stores user message as pending', async () => {
    const { db, seen } = makeChatDb();
    const res = await app.request('/api/chat/sessions/cht_1/messages', {
      method: 'POST', headers: authed, body: JSON.stringify({ texto: 'Qual o prazo do caso?' }),
    }, { DB: db });
    expect(res.status).toBe(201);
    expect(seen.some((s) => /INSERT INTO chat_messages/.test(s) && /'pending'/.test(s))).toBe(true);
    const body = await res.json() as { data: { estado: string } };
    expect(body.data.estado).toBe('pending');
  });
  it('404s on another user session', async () => {
    const { db } = makeChatDb({ sessionOwner: null });
    const res = await app.request('/api/chat/sessions/cht_x/messages', {
      method: 'POST', headers: authed, body: JSON.stringify({ texto: 'oi' }),
    }, { DB: db });
    expect(res.status).toBe(404);
  });
  it('rejects empty and oversized text', async () => {
    const { db } = makeChatDb();
    for (const texto of ['', 'x'.repeat(8001)]) {
      const res = await app.request('/api/chat/sessions/cht_1/messages', {
        method: 'POST', headers: authed, body: JSON.stringify({ texto }),
      }, { DB: db });
      expect(res.status).toBe(400);
    }
  });
});

describe('POST retry', () => {
  it('flips error back to pending', async () => {
    const { db, seen } = makeChatDb();
    const res = await app.request('/api/chat/sessions/cht_1/messages/chm_9/retry', {
      method: 'POST', headers: authed,
    }, { DB: db });
    expect(res.status).toBe(200);
    expect(seen.some((s) => /SET estado = 'pending'/.test(s) && /estado = 'error'/.test(s))).toBe(true);
  });
  it('404s when nothing flipped', async () => {
    const { db } = makeChatDb({ changes: 0 });
    const res = await app.request('/api/chat/sessions/cht_1/messages/chm_9/retry', {
      method: 'POST', headers: authed,
    }, { DB: db });
    expect(res.status).toBe(404);
  });
});

describe('GET /api/chat/outbox (adapter, Bearer-only)', () => {
  const bearer = { authorization: 'Bearer orbis_test' };
  it('returns pending with valid token and no cookie', async () => {
    const { db, seen } = makeChatDb({ tokenUser: { user_id: 'u1' }, outbox: [{ id: 'chm_1', session_id: 'cht_1', texto: 'oi' }] });
    const res = await app.request('/api/chat/outbox', { headers: bearer }, { DB: db });
    expect(res.status).toBe(200);
    expect(seen.some((s) => /SET estado = 'claimed'/.test(s) && /estado = 'pending'/.test(s))).toBe(true);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });
  it('401s with requestId chat (not auth) on bad token', async () => {
    const { db } = makeChatDb({ tokenUser: null });
    const res = await app.request('/api/chat/outbox', { headers: bearer }, { DB: db });
    expect(res.status).toBe(401);
    const body = await res.json() as { requestId: string };
    expect(body.requestId).toBe('chat');
  });
  it('ignores cookies: Bearer valid + no cookie still works', async () => {
    const { db } = makeChatDb({ tokenUser: { user_id: 'u1' }, outbox: [] });
    const res = await app.request('/api/chat/outbox', { headers: bearer }, { DB: db });
    expect(res.status).toBe(200);
  });
});

describe('POST /api/chat/inbox (adapter, Bearer-only)', () => {
  const bearer = { 'content-type': 'application/json', authorization: 'Bearer orbis_test' };
  it('stores agent reply as delivered', async () => {
    const { db, seen } = makeChatDb({ tokenUser: { user_id: 'u1' } });
    const res = await app.request('/api/chat/inbox', {
      method: 'POST', headers: bearer, body: JSON.stringify({ session_id: 'cht_1', texto: 'O prazo é dia 12.' }),
    }, { DB: db });
    expect(res.status).toBe(201);
    expect(seen.some((s) => /'agent'/.test(s) && /'delivered'/.test(s))).toBe(true);
  });
  it('404s on another user session', async () => {
    const { db } = makeChatDb({ tokenUser: { user_id: 'u1' }, sessionOwner: null });
    const res = await app.request('/api/chat/inbox', {
      method: 'POST', headers: bearer, body: JSON.stringify({ session_id: 'cht_x', texto: 'oi' }),
    }, { DB: db });
    expect(res.status).toBe(404);
  });
  it('401s without Bearer even with valid cookie', async () => {
    const { db } = makeChatDb();
    const res = await app.request('/api/chat/inbox', {
      method: 'POST', headers: authed, body: JSON.stringify({ session_id: 'cht_1', texto: 'oi' }),
    }, { DB: db });
    expect(res.status).toBe(401);
  });
});
