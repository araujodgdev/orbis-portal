import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../lib/auth';
import { err, reqId } from '../lib/errors';
import { verifyBearer } from '../mcp/auth';
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

chat.get('/sessions/:id/messages', async (c) => {
  const s = await ownSession(c.env.DB, c.req.param('id'), actorId(c));
  if (!s) return notFound();
  const rows = await c.env.DB.prepare(
    `SELECT id, remetente, texto, estado, created_at FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC LIMIT 200`
  ).bind(c.req.param('id')).all();
  return c.json({ data: rows.results });
});

chat.post('/sessions/:id/messages', async (c) => {
  try {
    const body = z.object({ texto: z.string().min(1).max(8000) }).parse(await c.req.json());
    const id = c.req.param('id');
    const s = await ownSession(c.env.DB, id, actorId(c));
    if (!s) return notFound();
    const mid = rid('chm');
    await c.env.DB.prepare(
      `INSERT INTO chat_messages (id, session_id, remetente, texto, estado) VALUES (?, ?, 'user', ?, 'pending')`
    ).bind(mid, id, body.texto).run();
    await c.env.DB.prepare(`UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?`).bind(id).run();
    await audit(c.env.DB, actorId(c), 'chat_message', 'chat_message', mid);
    return c.json({ data: { id: mid, estado: 'pending' } }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return err(e, 'invalid_chat_message', 400);
    return err(e);
  }
});

chat.post('/sessions/:id/messages/:mid/retry', async (c) => {
  const s = await ownSession(c.env.DB, c.req.param('id'), actorId(c));
  if (!s) return notFound();
  const r = await c.env.DB.prepare(
    `UPDATE chat_messages SET estado = 'pending', claimed_at = NULL WHERE id = ? AND remetente = 'user' AND estado = 'error'`
  ).bind(c.req.param('mid')).run() as unknown as { meta: { changes: number } };
  if (!r.meta?.changes) return notFound();
  return c.json({ ok: true });
});

chat.get('/outbox', async (c) => {
  const userId = await verifyBearer(c.env.DB, c.req.header('authorization'));
  if (!userId) return c.json({ error: 'unauthorized', code: 'unauthorized', requestId: 'chat' }, 401);
  const rows = await c.env.DB.prepare(
    `SELECT m.id, m.session_id, m.texto, m.created_at FROM chat_messages m
     JOIN chat_sessions s ON s.id = m.session_id
     WHERE s.user_id = ? AND m.remetente = 'user'
       AND (m.estado = 'pending' OR (m.estado = 'claimed' AND m.claimed_at < datetime('now', '-10 minutes')))
     ORDER BY m.created_at ASC LIMIT 20`
  ).bind(userId).all<{ id: string }>();
  const ids = rows.results.map((r) => r.id);
  if (ids.length > 0) {
    await c.env.DB.prepare(
      `UPDATE chat_messages SET estado = 'claimed', claimed_at = datetime('now') WHERE id IN (${ids.map(() => '?').join(',')}) AND (estado = 'pending' OR estado = 'claimed')`
    ).bind(...ids).run();
    await audit(c.env.DB, userId, 'chat_claim', 'chat_message', ids[0], { count: ids.length });
  }
  return c.json({ data: rows.results });
});

chat.post('/inbox', async (c) => {
  try {
    const userId = await verifyBearer(c.env.DB, c.req.header('authorization'));
    if (!userId) return c.json({ error: 'unauthorized', code: 'unauthorized', requestId: 'chat' }, 401);
    const body = z.object({ session_id: z.string().min(1), texto: z.string().min(1).max(8000) }).parse(await c.req.json());
    const s = await ownSession(c.env.DB, body.session_id, userId);
    if (!s) return notFound();
    const mid = rid('chm');
    await c.env.DB.prepare(
      `INSERT INTO chat_messages (id, session_id, remetente, texto, estado) VALUES (?, ?, 'agent', ?, 'delivered')`
    ).bind(mid, body.session_id, body.texto).run();
    await c.env.DB.prepare(`UPDATE chat_sessions SET updated_at = datetime('now') WHERE id = ?`).bind(body.session_id).run();
    await audit(c.env.DB, userId, 'chat_reply', 'chat_message', mid);
    return c.json({ data: { id: mid } }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return err(e, 'invalid_chat_inbox', 400);
    return err(e);
  }
});
