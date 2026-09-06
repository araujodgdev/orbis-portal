import { describe, it, expect } from 'vitest';
import app from '../src/index';

type Row = Record<string, unknown>;
export function makeChatDb(opts: {
  sessionOwner?: Row | null;
  sessionRow?: Row | null;
  sessionList?: Row[];
  tokenUser?: Row | null;
  messages?: Row[];
  outbox?: Row[];
  retryRow?: Row | null;
  claimedRow?: Row | null;
  changes?: number;
} = {}) {
  const seen: string[] = [];
  const bound: { sql: string; args: unknown[] }[] = [];
  const db = {
    prepare: (sql: string) => {
      seen.push(sql);
      return {
        bind: (...args: unknown[]) => {
          bound.push({ sql, args });
          return {
          first: async () => {
            if (/FROM chat_sessions/.test(sql)) {
              if (/AND user_id/.test(sql)) {
                if (opts.sessionOwner !== undefined) return opts.sessionOwner;
                return { id: 'cht_1', user_id: 'u1' };
              }
              if (opts.sessionRow !== undefined) return opts.sessionRow;
              return { id: 'cht_9', titulo: 'Chat', updated_at: '2026-09-06T10:00:00.000Z' };
            }
            if (/FROM api_tokens/.test(sql)) return opts.tokenUser !== undefined ? opts.tokenUser : null;
            if (/FROM sessions/.test(sql)) return { user_id: 'u1', expires_at: '2999-01-01T00:00:00.000Z' };
            if (/FROM chat_messages/.test(sql)) {
              if (/id = \? AND session_id/.test(sql)) {
                if (opts.retryRow !== undefined) return opts.retryRow;
                return { id: 'chm_9', remetente: 'user', created_at: '2026-09-06 10:00:00' };
              }
              return opts.claimedRow !== undefined ? opts.claimedRow : null;
            }
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
          };
        },
      };
    },
  };
  return { db: db as never, seen, bound };
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

describe('POST retry (R3: re-queue, never duplicate)', () => {
  it('flips a user error row back to pending', async () => {
    const { db, seen, bound } = makeChatDb();
    const res = await app.request('/api/chat/sessions/cht_1/messages/chm_9/retry', {
      method: 'POST', headers: authed,
    }, { DB: db });
    expect(res.status).toBe(200);
    expect(seen.some((s) => /FROM chat_messages/.test(s) && /id = \? AND session_id = \?/.test(s) && /estado = 'error'/.test(s))).toBe(true);
    expect(bound.some((b) => /SET estado = 'pending'/.test(b.sql) && b.args.includes('chm_9'))).toBe(true);
  });
  it('404s when the target is not an error row in this session (cross-session flip)', async () => {
    const { db } = makeChatDb({ retryRow: null });
    const res = await app.request('/api/chat/sessions/cht_1/messages/chm_other/retry', {
      method: 'POST', headers: authed,
    }, { DB: db });
    expect(res.status).toBe(404);
  });
  it('agent error notice re-queues the latest claimed user row, marks notice delivered, adds zero rows', async () => {
    const { db, seen, bound } = makeChatDb({
      retryRow: { id: 'chm_e', remetente: 'agent', created_at: '2026-09-06 10:05:00' },
      claimedRow: { id: 'chm_u' },
    });
    const res = await app.request('/api/chat/sessions/cht_1/messages/chm_e/retry', {
      method: 'POST', headers: authed,
    }, { DB: db });
    expect(res.status).toBe(200);
    expect(bound.some((b) => /SET estado = 'pending'/.test(b.sql) && b.args.includes('chm_u'))).toBe(true);
    expect(bound.some((b) => /SET estado = 'delivered'/.test(b.sql) && b.args.includes('chm_e'))).toBe(true);
    expect(seen.filter((s) => /INSERT INTO chat_messages/.test(s))).toHaveLength(0);
  });
  it('agent error notice with no claimed user row just marks the notice delivered', async () => {
    const { db, bound } = makeChatDb({
      retryRow: { id: 'chm_e', remetente: 'agent', created_at: '2026-09-06 10:05:00' },
      claimedRow: null,
    });
    const res = await app.request('/api/chat/sessions/cht_1/messages/chm_e/retry', {
      method: 'POST', headers: authed,
    }, { DB: db });
    expect(res.status).toBe(200);
    expect(bound.some((b) => /SET estado = 'delivered'/.test(b.sql) && b.args.includes('chm_e'))).toBe(true);
    expect(bound.some((b) => /SET estado = 'pending'/.test(b.sql))).toBe(false);
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
    const { db, seen, bound } = makeChatDb({ tokenUser: { user_id: 'u1' } });
    const res = await app.request('/api/chat/inbox', {
      method: 'POST', headers: bearer, body: JSON.stringify({ session_id: 'cht_1', texto: 'O prazo é dia 12.' }),
    }, { DB: db });
    expect(res.status).toBe(201);
    expect(seen.some((s) => /INSERT INTO chat_messages/.test(s) && /'agent'/.test(s))).toBe(true);
    expect(bound.find((b) => /INSERT INTO chat_messages/.test(b.sql))!.args).toContain('delivered');
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
  it('stores an agent error notice when estado=error', async () => {
    const { db, bound } = makeChatDb({ tokenUser: { user_id: 'u1' } });
    const res = await app.request('/api/chat/inbox', {
      method: 'POST', headers: bearer, body: JSON.stringify({ session_id: 'cht_1', texto: 'Falha no agente.', estado: 'error' }),
    }, { DB: db });
    expect(res.status).toBe(201);
    const ins = bound.find((b) => /INSERT INTO chat_messages/.test(b.sql));
    expect(ins).toBeDefined();
    expect(ins!.args).toContain('error');
  });
  it('accepts reply_to but ignores it (no such column)', async () => {
    const { db, seen } = makeChatDb({ tokenUser: { user_id: 'u1' } });
    const res = await app.request('/api/chat/inbox', {
      method: 'POST', headers: bearer, body: JSON.stringify({ session_id: 'cht_1', texto: 'oi', reply_to: 'chm_1' }),
    }, { DB: db });
    expect(res.status).toBe(201);
    expect(seen.every((s) => !/reply_to/.test(s))).toBe(true);
  });
  it('rejects unknown estado values', async () => {
    const { db } = makeChatDb({ tokenUser: { user_id: 'u1' } });
    const res = await app.request('/api/chat/inbox', {
      method: 'POST', headers: bearer, body: JSON.stringify({ session_id: 'cht_1', texto: 'oi', estado: 'weird' }),
    }, { DB: db });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/chat/outbox claim shape (atomic, single statement)', () => {
  const bearer = { authorization: 'Bearer orbis_test' };
  it('claims with one UPDATE…RETURNING carrying the stale-claim guard', async () => {
    const { db, seen } = makeChatDb({ tokenUser: { user_id: 'u1' }, outbox: [{ id: 'chm_1', session_id: 'cht_1', texto: 'oi' }] });
    const res = await app.request('/api/chat/outbox', { headers: bearer }, { DB: db });
    expect(res.status).toBe(200);
    const updates = seen.filter((s) => /UPDATE chat_messages/.test(s));
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatch(/RETURNING/);
    expect(updates[0]).toMatch(/claimed_at < datetime\('now', '-10 minutes'\)/);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(1);
  });
  it('second poller (concurrent claim won) gets [] and no audit row', async () => {
    const { db, seen } = makeChatDb({ tokenUser: { user_id: 'u1' }, outbox: [] });
    const res = await app.request('/api/chat/outbox', { headers: bearer }, { DB: db });
    expect(res.status).toBe(200);
    const body = await res.json() as { data: unknown[] };
    expect(body.data).toHaveLength(0);
    expect(seen.some((s) => /audit_logs/.test(s))).toBe(false);
  });
  it('never returns agent rows (remetente=user scoped)', async () => {
    const { db, seen } = makeChatDb({ tokenUser: { user_id: 'u1' }, outbox: [] });
    const res = await app.request('/api/chat/outbox', { headers: bearer }, { DB: db });
    expect(res.status).toBe(200);
    const selects = seen.filter((s) => /FROM chat_messages/.test(s));
    expect(selects.length).toBeGreaterThan(0);
    expect(selects.every((s) => /remetente = 'user'/.test(s))).toBe(true);
  });
  it('conflicting credentials scope to the Bearer owner, ignoring the cookie', async () => {
    const { db, bound } = makeChatDb({ tokenUser: { user_id: 'u2' }, outbox: [] });
    const res = await app.request('/api/chat/outbox', {
      headers: { ...bearer, cookie: 'orbis_session=fake' },
    }, { DB: db });
    expect(res.status).toBe(200);
    const claim = bound.find((b) => /UPDATE chat_messages/.test(b.sql));
    expect(claim).toBeDefined();
    expect(claim!.args).toEqual(['u2']);
  });
});

describe('adapter auth scoping vs cookie user', () => {
  it('inbox 404s when the session belongs to the cookie user but not the Bearer owner', async () => {
    const { db } = makeChatDb({ tokenUser: { user_id: 'u2' }, sessionOwner: null });
    const res = await app.request('/api/chat/inbox', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer orbis_test', cookie: 'orbis_session=fake' },
      body: JSON.stringify({ session_id: 'cht_1', texto: 'oi' }),
    }, { DB: db });
    expect(res.status).toBe(404);
  });
});

describe('POST /api/chat/sessions response', () => {
  it('includes updated_at', async () => {
    const { db } = makeChatDb({ sessionRow: { id: 'cht_9', titulo: 'Chat', updated_at: '2026-09-06T10:00:00.000Z' } });
    const res = await app.request('/api/chat/sessions', {
      method: 'POST', headers: authed, body: JSON.stringify({}),
    }, { DB: db });
    expect(res.status).toBe(201);
    const body = await res.json() as { data: { id: string; titulo: string; updated_at: string } };
    expect(body.data.updated_at).toBe('2026-09-06T10:00:00.000Z');
  });
});

describe('PATCH /api/chat/sessions/:id titulo', () => {
  it('rejects whitespace-only titulo with 400', async () => {
    const { db } = makeChatDb();
    const res = await app.request('/api/chat/sessions/cht_1', {
      method: 'PATCH', headers: authed, body: JSON.stringify({ titulo: '   ' }),
    }, { DB: db });
    expect(res.status).toBe(400);
  });
});

describe('DELETE /api/chat/sessions/:id removes messages', () => {
  it('deletes chat_messages for the session before deleting the session', async () => {
    const { db, seen, bound } = makeChatDb();
    const res = await app.request('/api/chat/sessions/cht_1', {
      method: 'DELETE', headers: authed,
    }, { DB: db });
    expect(res.status).toBe(200);
    const msgDel = bound.find((b) => /DELETE FROM chat_messages/.test(b.sql));
    expect(msgDel).toBeDefined();
    expect(msgDel!.args).toEqual(['cht_1']);
    const msgIdx = seen.findIndex((s) => /DELETE FROM chat_messages/.test(s));
    const sesIdx = seen.findIndex((s) => /DELETE FROM chat_sessions/.test(s));
    expect(msgIdx).toBeGreaterThanOrEqual(0);
    expect(sesIdx).toBeGreaterThanOrEqual(0);
    expect(msgIdx).toBeLessThan(sesIdx);
  });
  it('404s on another user session and deletes nothing', async () => {
    const { db, seen } = makeChatDb({ sessionOwner: null });
    const res = await app.request('/api/chat/sessions/cht_x', {
      method: 'DELETE', headers: authed,
    }, { DB: db });
    expect(res.status).toBe(404);
    expect(seen.some((s) => /DELETE FROM chat_messages/.test(s))).toBe(false);
    expect(seen.some((s) => /DELETE FROM chat_sessions/.test(s))).toBe(false);
  });
});
