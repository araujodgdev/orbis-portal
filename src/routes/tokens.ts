import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../lib/auth';
import { err } from '../lib/errors';
import type { Env } from '../index';

export const tokens = new Hono<{ Bindings: Env }>();

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function actorId(c: { get: (k: never) => unknown }): string {
  return c.get('actor' as never) as string;
}

tokens.post('/', async (c) => {
  try {
    const body = z.object({ nome: z.string().max(60).default('') }).parse(await c.req.json());
    const uid = actorId(c);
    const raw = [...crypto.getRandomValues(new Uint8Array(16))].map((b) => b.toString(16).padStart(2, '0')).join('');
    const token = `orbis_${raw}`;
    const id = `tok_${Math.random().toString(36).slice(2, 10)}`;
    await c.env.DB.prepare(`INSERT INTO api_tokens (id, user_id, nome, token_hash) VALUES (?, ?, ?, ?)`)
      .bind(id, uid, body.nome, await hashToken(token)).run();
    await audit(c.env.DB, uid, 'token_create', 'api_token', id);
    return c.json({ data: { id, nome: body.nome }, token }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return err(e, 'invalid_token', 400);
    return err(e);
  }
});

tokens.get('/', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT id, nome, substr(token_hash, 1, 10) AS prefixo, created_at, revogado_em FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`
  ).bind(actorId(c)).all();
  return c.json({ data: rows.results });
});

tokens.delete('/:id', async (c) => {
  await c.env.DB.prepare(`UPDATE api_tokens SET revogado_em = datetime('now') WHERE id = ? AND user_id = ?`)
    .bind(c.req.param('id'), actorId(c)).run();
  await audit(c.env.DB, actorId(c), 'token_revoke', 'api_token', c.req.param('id'));
  return c.json({ ok: true });
});
