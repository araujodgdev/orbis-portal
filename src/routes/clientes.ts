// src/routes/clientes.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../lib/auth';
import { err } from '../lib/errors';
import type { Env } from '../index';

const schema = z.object({
  nome: z.string().min(2).max(120),
  contato: z.string().max(200).default(''),
  honorario_status: z.string().max(40).default('ativo'),
});

export const clientes = new Hono<{ Bindings: Env }>();

clientes.get('/', async (c) => {
  const rows = await c.env.DB.prepare(`SELECT * FROM clientes ORDER BY nome LIMIT 100`).all();
  return c.json({ data: rows.results });
});

clientes.post('/', async (c) => {
  try {
    const body = schema.parse(await c.req.json());
    const id = `cli_${Math.random().toString(36).slice(2, 10)}`;
    await c.env.DB.prepare(`INSERT INTO clientes (id, nome, contato, honorario_status) VALUES (?, ?, ?, ?)`)
      .bind(id, body.nome, body.contato, body.honorario_status).run();
    await audit(c.env.DB, 'portal', 'create', 'cliente', id);
    return c.json({ data: { id, ...body } }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return err(e, 'invalid_cliente', 400);
    return err(e);
  }
});

clientes.get('/:id', async (c) => {
  const row = await c.env.DB.prepare(`SELECT * FROM clientes WHERE id = ?`).bind(c.req.param('id')).first();
  if (!row) return c.json({ error: 'not_found', code: 'not_found', requestId: 'cli' }, 404);
  const procs = await c.env.DB.prepare(`SELECT id, numero_cnj, fase, status FROM processos WHERE cliente_id = ? LIMIT 50`)
    .bind(c.req.param('id')).all();
  return c.json({ data: row, processos: procs.results });
});
