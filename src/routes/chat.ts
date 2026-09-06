import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../lib/auth';
import { err, reqId } from '../lib/errors';
import type { Env } from '../index';

export const chat = new Hono<{ Bindings: Env }>();

function actorId(c: { get: (k: never) => unknown }): string {
  return c.get('actor' as never) as string;
}

function rid(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function ownSession(db: D1Database, id: string, userId: string) {
  return db.prepare(`SELECT id FROM chat_sessions WHERE id = ? AND user_id = ?`).bind(id, userId).first<{ id: string }>();
}

function notFound() {
  return Response.json({ error: 'not_found', code: 'not_found', requestId: reqId() }, { status: 404 });
}

chat.get('/sessions', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, titulo, updated_at FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50`
  ).bind(actorId(c)).all();
  return c.json({ data: rows.results });
});

chat.post('/sessions', async (c) => {
  try {
    const body = z.object({ titulo: z.string().max(80).default('') }).parse(await c.req.json());
    const titulo = body.titulo.trim() || `Chat ${new Date().toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}`;
    const id = rid('cht');
    await c.env.DB.prepare(`INSERT INTO chat_sessions (id, user_id, titulo) VALUES (?, ?, ?)`)
      .bind(id, actorId(c), titulo).run();
    await audit(c.env.DB, actorId(c), 'chat_session_create', 'chat_session', id);
    return c.json({ data: { id, titulo } }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return err(e, 'invalid_chat_session', 400);
    return err(e);
  }
});

chat.patch('/sessions/:id', async (c) => {
  try {
    const body = z.object({ titulo: z.string().min(1).max(80) }).parse(await c.req.json());
    const r = await c.env.DB.prepare(
      `UPDATE chat_sessions SET titulo = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`
    ).bind(body.titulo.trim(), c.req.param('id'), actorId(c)).run() as unknown as { meta: { changes: number } };
    if (!r.meta?.changes) return notFound();
    await audit(c.env.DB, actorId(c), 'chat_session_rename', 'chat_session', c.req.param('id'));
    return c.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return err(e, 'invalid_chat_session', 400);
    return err(e);
  }
});

chat.delete('/sessions/:id', async (c) => {
  const r = await c.env.DB.prepare(`DELETE FROM chat_sessions WHERE id = ? AND user_id = ?`)
    .bind(c.req.param('id'), actorId(c)).run() as unknown as { meta: { changes: number } };
  if (!r.meta?.changes) return notFound();
  await audit(c.env.DB, actorId(c), 'chat_session_delete', 'chat_session', c.req.param('id'));
  return c.json({ ok: true });
});
