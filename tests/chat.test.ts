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
