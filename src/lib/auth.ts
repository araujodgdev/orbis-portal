import type { Context, Next } from 'hono';

export async function hashPass(pass: string): Promise<string> {
  const data = new TextEncoder().encode(`orbis:${pass}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function audit(
  db: D1Database, actor: string, acao: string, entidade: string, entidade_id: string, meta: unknown = {}
): Promise<void> {
  const id = `aud_${Math.random().toString(36).slice(2, 10)}`;
  await db.prepare(`INSERT INTO audit_logs (id, actor, acao, entidade, entidade_id, meta_json) VALUES (?, ?, ?, ?, ?, ?)`)
    .bind(id, actor, acao, entidade, entidade_id, JSON.stringify(meta)).run();
}

export async function requireAuth(c: Context<{ Bindings: { DB: D1Database } }>, next: Next) {
  if (['/api/health', '/api/login', '/api/signup', '/api/chat/outbox', '/api/chat/inbox'].includes(c.req.path)) return next();
  const db = (c.env as { DB?: D1Database } | undefined)?.DB;
  if (!db) return c.json({ error: 'unauthorized', code: 'unauthorized', requestId: 'auth' }, 401);
  const cookie = c.req.header('cookie') ?? '';
  const m = cookie.match(/orbis_session=([A-Za-z0-9_-]+)/);
  if (!m) return c.json({ error: 'unauthorized', code: 'unauthorized', requestId: 'auth' }, 401);
  const s = await db.prepare(`SELECT user_id, expires_at FROM sessions WHERE id = ?`).bind(m[1]).first<{ user_id: string; expires_at: string }>();
  if (!s || s.expires_at < new Date().toISOString()) {
    return c.json({ error: 'unauthorized', code: 'unauthorized', requestId: 'auth' }, 401);
  }
  c.set('actor' as never, s.user_id as never);
  await next();
}
