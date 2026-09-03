// src/routes/noticias.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../lib/auth';
import { err } from '../lib/errors';
import type { Env } from '../index';

export const noticias = new Hono<{ Bindings: Env }>();
const schema = z.object({
  titulo: z.string().min(4).max(200),
  link: z.string().url().max(500),
  resumo: z.string().max(2000).default(''),
  area: z.string().max(40).default('geral'),
  fonte: z.string().max(80).default(''),
});

noticias.get('/', async (c) => {
  const area = (c.req.query('area') ?? '').trim();
  const rows = area
    ? await c.env.DB.prepare(`SELECT * FROM noticias WHERE area = ? ORDER BY publicado_em DESC LIMIT 50`).bind(area).all()
    : await c.env.DB.prepare(`SELECT * FROM noticias ORDER BY publicado_em DESC LIMIT 50`).all();
  return c.json({ data: rows.results });
});

noticias.post('/', async (c) => {
  try {
    const body = schema.parse(await c.req.json());
    if (!/^https?:\/\//.test(body.link)) throw new Error('URL deve ser http(s)');
    const id = `not_${Math.random().toString(36).slice(2, 10)}`;
    await c.env.DB.prepare(`INSERT INTO noticias (id, titulo, link, resumo, area, fonte) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(id, body.titulo, body.link, body.resumo, body.area, body.fonte).run();
    await audit(c.env.DB, 'portal', 'create', 'noticia', id);
    return c.json({ data: { id, ...body } }, 201);
  } catch (e) { return err(e, 'invalid_noticia', 400); }
});
