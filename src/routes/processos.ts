import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../lib/auth';
import { err } from '../lib/errors';
import { isCNJ } from '../lib/validate';
import type { Env } from '../index';

export const schema = z.object({
  cliente_id: z.string().min(3),
  numero_cnj: z.string().refine(isCNJ, 'CNJ inválido. Use NNNNNNN-DD.AAAA.J.TR.OOOO'),
  tribunal: z.string().max(20).default(''),
  fase: z.string().max(40).default('conhecimento'),
  responsavel: z.string().max(120).default(''),
  area: z.string().max(40).default('civel'),
});

export const processos = new Hono<{ Bindings: Env }>();

const patchSchema = z.object({
  fase: z.string().max(40).optional(),
  responsavel: z.string().max(120).optional(),
  area: z.string().max(40).optional(),
  tribunal: z.string().max(20).optional(),
  status: z.enum(['ativo', 'arquivado']).optional(),
}).refine((b) => Object.keys(b).length > 0, 'Nada para atualizar');

processos.get('/', async (c) => {
  const q = (c.req.query('q') ?? '').trim();
  const status = (c.req.query('status') ?? '').trim();
  const fase = (c.req.query('fase') ?? '').trim();
  let sql = `SELECT p.*, cl.nome AS cliente_nome FROM processos p JOIN clientes cl ON cl.id = p.cliente_id WHERE 1=1`;
  const args: unknown[] = [];
  if (q) { const qEsc = q.replace(/[%_\\]/g, (m) => '\\' + m); sql += ` AND (p.numero_cnj LIKE ? ESCAPE '\\' OR cl.nome LIKE ? ESCAPE '\\')`; args.push(`%${qEsc}%`, `%${qEsc}%`); }
  if (status) { sql += ` AND p.status = ?`; args.push(status); }
  if (fase) { sql += ' AND p.fase = ?'; args.push(fase); }
  sql += ` ORDER BY p.created_at DESC LIMIT 100`;
  const rows = await c.env.DB.prepare(sql).bind(...args as string[]).all();
  return c.json({ data: rows.results });
});

processos.post('/', async (c) => {
  try {
    const body = schema.parse(await c.req.json());
    const id = `pro_${Math.random().toString(36).slice(2, 10)}`;
    await c.env.DB.prepare(
      `INSERT INTO processos (id, cliente_id, numero_cnj, tribunal, fase, responsavel, area) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, body.cliente_id, body.numero_cnj, body.tribunal, body.fase, body.responsavel, body.area).run();
    await audit(c.env.DB, 'portal', 'create', 'processo', id);
    return c.json({ data: { id, ...body } }, 201);
  } catch (e) {
    if (e instanceof z.ZodError) return err(e, 'invalid_processo', 400);
    return err(e);
  }
});

processos.get('/:id', async (c) => {
  const id = c.req.param('id');
  const p = await c.env.DB.prepare(`SELECT * FROM processos WHERE id = ?`).bind(id).first();
  if (!p) return c.json({ error: 'not_found', code: 'not_found', requestId: 'pro' }, 404);
  const movs = await c.env.DB.prepare(`SELECT * FROM movimentacoes WHERE processo_id = ? ORDER BY data DESC LIMIT 100`).bind(id).all();
  const prz = await c.env.DB.prepare(`SELECT * FROM prazos WHERE processo_id = ? ORDER BY data ASC LIMIT 100`).bind(id).all();
  const docs = await c.env.DB.prepare(`SELECT id, titulo, rascunho, created_at FROM documentos WHERE processo_id = ? ORDER BY created_at DESC LIMIT 100`).bind(id).all();
  await audit(c.env.DB, 'portal', 'view', 'processo', id);
  return c.json({ data: p, movimentacoes: movs.results, prazos: prz.results, documentos: docs.results });
});

processos.patch('/:id', async (c) => {
  try {
    const body = patchSchema.parse(await c.req.json());
    const id = c.req.param('id');
    const row = await c.env.DB.prepare(`SELECT id FROM processos WHERE id = ?`).bind(id).first();
    if (!row) return c.json({ error: 'not_found', code: 'not_found', requestId: 'pro' }, 404);
    const keys = Object.keys(body) as (keyof typeof body)[];
    await c.env.DB.prepare(`UPDATE processos SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .bind(...keys.map((k) => body[k]), id).run();
    await audit(c.env.DB, 'portal', 'update', 'processo', id);
    return c.json({ data: { id, ...body } });
  } catch (e) {
    if (e instanceof z.ZodError) return err(e, 'invalid_processo', 400);
    return err(e);
  }
});
