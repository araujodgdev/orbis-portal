import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../lib/auth';
import { err } from '../lib/errors';
import type { Env } from '../index';

const schema = z.object({
  nome: z.string().min(2).max(120),
  areas: z.array(z.string().max(40)).max(12).default([]),
  tamanho_equipe: z.string().max(40).default(''),
});

export const onboarding = new Hono<{ Bindings: Env }>();

function actorId(c: { get: (k: never) => unknown }): string {
  return c.get('actor' as never) as string;
}

onboarding.get('/', async (c) => {
  const uid = actorId(c);
  const u = await c.env.DB.prepare(`SELECT onboarding_done FROM users WHERE id = ?`).bind(uid)
    .first<{ onboarding_done: number }>();
  if (!u) return c.json({ error: 'unauthorized', code: 'unauthorized', requestId: 'onb' }, 401);
  const esc = await c.env.DB.prepare(
    `SELECT id, nome, areas, tamanho_equipe FROM escritorios WHERE owner_user_id = ?`
  ).bind(uid).first();
  return c.json({ data: { done: u.onboarding_done === 1, escritorio: esc ?? null } });
});

onboarding.post('/', async (c) => {
  try {
    const body = schema.parse(await c.req.json());
    const uid = actorId(c);
    const id = `esc_${Math.random().toString(36).slice(2, 10)}`;
    await c.env.DB.prepare(
      `INSERT INTO escritorios (id, owner_user_id, nome, areas, tamanho_equipe) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(owner_user_id) DO UPDATE SET nome = excluded.nome, areas = excluded.areas, tamanho_equipe = excluded.tamanho_equipe`
    ).bind(id, uid, body.nome, JSON.stringify(body.areas), body.tamanho_equipe).run();
    await c.env.DB.prepare(`UPDATE users SET onboarding_done = 1 WHERE id = ?`).bind(uid).run();
    await audit(c.env.DB, uid, 'onboarding', 'escritorio', id);
    return c.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return err(e, 'invalid_onboarding', 400);
    return err(e);
  }
});
