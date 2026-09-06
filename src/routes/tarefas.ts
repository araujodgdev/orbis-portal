// src/routes/tarefas.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../lib/auth';
import { err } from '../lib/errors';
import type { Env } from '../index';

export const tarefas = new Hono<{ Bindings: Env }>();

const patchSchema = z.object({
  titulo: z.string().min(2).max(200).optional(),
  responsavel: z.string().max(120).optional(),
  vencimento: z.string().min(8).max(10).optional(),
  status: z.enum(['aberta', 'concluida']).optional(),
}).refine((b) => Object.keys(b).length > 0, 'Nada para atualizar');

export const schema = z.object({
  processo_id: z.string().min(3),
  titulo: z.string().min(2).max(200),
  responsavel: z.string().max(120).default(''),
  vencimento: z.string().min(8).max(10),
});

tarefas.get('/', async (c) => {
  const rows = await c.env.DB.prepare(`SELECT * FROM tarefas ORDER BY vencimento ASC LIMIT 100`).all();
  return c.json({ data: rows.results });
});

tarefas.post('/', async (c) => {
  try {
    const body = schema.parse(await c.req.json());
    const id = `tar_${Math.random().toString(36).slice(2, 10)}`;
    await c.env.DB.prepare(`INSERT INTO tarefas (id, processo_id, titulo, responsavel, vencimento) VALUES (?, ?, ?, ?, ?)`)
      .bind(id, body.processo_id, body.titulo, body.responsavel, body.vencimento).run();
    await audit(c.env.DB, 'portal', 'create', 'tarefa', id);
    return c.json({ data: { id, ...body } }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return err(e, 'invalid_tarefa', 400);
    return err(e);
  }
});

tarefas.patch('/:id', async (c) => {
  try {
    const body = patchSchema.parse(await c.req.json());
    const id = c.req.param('id');
    const row = await c.env.DB.prepare(`SELECT id FROM tarefas WHERE id = ?`).bind(id).first();
    if (!row) return c.json({ error: 'not_found', code: 'not_found', requestId: 'tar' }, 404);
    const keys = Object.keys(body) as (keyof typeof body)[];
    await c.env.DB.prepare(`UPDATE tarefas SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .bind(...keys.map((k) => body[k]), id).run();
    await audit(c.env.DB, 'portal', 'update', 'tarefa', id);
    return c.json({ data: { id, ...body } });
  } catch (e) {
    if (e instanceof z.ZodError) return err(e, 'invalid_tarefa', 400);
    return err(e);
  }
});

tarefas.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(`SELECT id FROM tarefas WHERE id = ?`).bind(id).first();
  if (!row) return c.json({ error: 'not_found', code: 'not_found', requestId: 'tar' }, 404);
  await c.env.DB.prepare(`DELETE FROM tarefas WHERE id = ?`).bind(id).run();
  await audit(c.env.DB, 'portal', 'delete', 'tarefa', id);
  return c.json({ ok: true });
});
