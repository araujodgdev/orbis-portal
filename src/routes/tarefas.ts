// src/routes/tarefas.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../lib/auth';
import { err } from '../lib/errors';
import type { Env } from '../index';

export const tarefas = new Hono<{ Bindings: Env }>();
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
