import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../lib/auth';
import { err } from '../lib/errors';
import { isDateYYYYMMDD } from '../lib/validate';
import type { Env } from '../index';

export const prazos = new Hono<{ Bindings: Env }>();
const schema = z.object({ data: z.string().refine(isDateYYYYMMDD, 'Data inválida. Use AAAA-MM-DD'), tipo: z.string().max(40).default('manifestacao') });

prazos.post('/processo/:pid', async (c) => {
  try {
    const body = schema.parse(await c.req.json());
    const id = `prz_${Math.random().toString(36).slice(2, 10)}`;
    await c.env.DB.prepare(`INSERT INTO prazos (id, processo_id, data, tipo) VALUES (?, ?, ?, ?)`)
      .bind(id, c.req.param('pid'), body.data, body.tipo).run();
    await audit(c.env.DB, 'portal', 'create', 'prazo', id);
    return c.json({ data: { id, ...body } }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return err(e, 'invalid_prazo', 400);
    return err(e);
  }
});

prazos.patch('/:id', async (c) => {
  const { status } = await c.req.json() as { status: string };
  if (!['aberto', 'cumprido', 'perdido'].includes(status)) return c.json({ error: 'invalid_status', code: 'invalid_status', requestId: 'prz' }, 400);
  await c.env.DB.prepare(`UPDATE prazos SET status = ? WHERE id = ?`).bind(status, c.req.param('id')).run();
  return c.json({ ok: true });
});

prazos.post('/varredura-perdidos', async (c) => {
  const today = new Date().toISOString().slice(0, 10);
  const r = await c.env.DB.prepare(`UPDATE prazos SET status = 'perdido' WHERE data < ? AND status = 'aberto'`).bind(today).run();
  return c.json({ ok: true, marcados: r.meta.changes });
});
