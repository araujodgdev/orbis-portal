import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../lib/auth';
import { err } from '../lib/errors';
import type { Env } from '../index';

export const movimentacoes = new Hono<{ Bindings: Env }>();

movimentacoes.get('/nao-lidas', async (c) => {
  const rows = await c.env.DB.prepare(
    `SELECT m.*, p.numero_cnj FROM movimentacoes m JOIN processos p ON p.id = m.processo_id WHERE m.lida = 0 ORDER BY m.data DESC LIMIT 100`
  ).all();
  return c.json({ data: rows.results });
});

movimentacoes.patch('/:id/lida', async (c) => {
  await c.env.DB.prepare(`UPDATE movimentacoes SET lida = 1 WHERE id = ?`).bind(c.req.param('id')).run();
  await audit(c.env.DB, 'portal', 'update', 'movimentacao', c.req.param('id'));
  return c.json({ ok: true });
});

const schema = z.object({ data: z.string().min(8).max(10), texto: z.string().min(3).max(4000) });

movimentacoes.post('/processo/:pid', async (c) => {
  try {
    const body = schema.parse(await c.req.json());
    const id = `mov_${Math.random().toString(36).slice(2, 10)}`;
    await c.env.DB.prepare(`INSERT INTO movimentacoes (id, processo_id, data, texto, lida, origem) VALUES (?, ?, ?, ?, 0, 'manual')`)
      .bind(id, c.req.param('pid'), body.data, body.texto).run();
    await audit(c.env.DB, 'portal', 'create', 'movimentacao', id);
    return c.json({ data: { id, ...body } }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return err(e, 'invalid_movimentacao', 400);
    return err(e);
  }
});
