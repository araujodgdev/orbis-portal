// src/routes/clientes.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../lib/auth';
import { err } from '../lib/errors';
import type { Env } from '../index';

const HONORARIO_STATUS = ['em dia', 'atrasado', 'suspenso', 'quitado'] as const;
const HONORARIO_FORMA = ['mensal', 'exito', 'fixo'] as const;
const emailOuVazio = z.string().max(160).default('').refine((v) => v === '' || /.+@.+\..+/.test(v), 'E-mail inválido');
const diaOuVazio = z.string().max(2).default('').refine((v) => v === '' || /^(0?[1-9]|[12][0-9]|3[01])$/.test(v), 'Dia inválido (1-31)');

export const schema = z.object({
  nome: z.string().min(2).max(120),
  tipo: z.enum(['pf', 'pj']).default('pf'),
  cpf_cnpj: z.string().max(18).default(''),
  doc_extra: z.string().max(30).default(''),
  email: emailOuVazio,
  telefone: z.string().max(20).default(''),
  endereco: z.string().max(300).default(''),
  contato: z.string().max(200).default(''),
  observacoes: z.string().max(2000).default(''),
  honorario_status: z.enum(HONORARIO_STATUS).default('em dia'),
  honorario_valor: z.number().int().min(0).default(0),
  honorario_vencimento: diaOuVazio,
  honorario_forma: z.enum(HONORARIO_FORMA).default('mensal'),
});

export const clientes = new Hono<{ Bindings: Env }>();

const patchSchema = z.object({
  nome: z.string().min(2).max(120).optional(),
  tipo: z.enum(['pf', 'pj']).optional(),
  cpf_cnpj: z.string().max(18).optional(),
  doc_extra: z.string().max(30).optional(),
  email: z.string().max(160).refine((v) => v === '' || /.+@.+\..+/.test(v), 'E-mail inválido').optional(),
  telefone: z.string().max(20).optional(),
  endereco: z.string().max(300).optional(),
  contato: z.string().max(200).optional(),
  observacoes: z.string().max(2000).optional(),
  honorario_status: z.enum(HONORARIO_STATUS).optional(),
  honorario_valor: z.number().int().min(0).optional(),
  honorario_vencimento: z.string().max(2).refine((v) => v === '' || /^(0?[1-9]|[12][0-9]|3[01])$/.test(v), 'Dia inválido (1-31)').optional(),
  honorario_forma: z.enum(HONORARIO_FORMA).optional(),
}).refine((b) => Object.keys(b).length > 0, 'Nada para atualizar');

clientes.get('/', async (c) => {
  const nome = (c.req.query('nome') ?? '').trim();
  const docs = ['cpf', 'cnpj'].map((k) => (c.req.query(k) ?? '').trim()).filter((v) => v.length > 0);
  const conds: string[] = [];
  const args: string[] = [];
  if (nome) {
    conds.push(`nome LIKE ?`);
    args.push(`%${nome}%`);
  }
  if (docs.length > 0) {
    // Compara o texto como digitado e, quando houver máscara, também só os
    // dígitos — "12345678000190" encontra "12.345.678/0001-90".
    const parts: string[] = [];
    for (const d of docs) {
      parts.push(`cpf_cnpj LIKE ?`);
      args.push(`%${d}%`);
      const digits = d.replace(/\D/g, '');
      if (digits && digits !== d) {
        parts.push(`REPLACE(REPLACE(REPLACE(cpf_cnpj, '.', ''), '-', ''), '/', '') LIKE ?`);
        args.push(`%${digits}%`);
      }
    }
    conds.push(`(${parts.join(' OR ')})`);
  }
  const stmt = c.env.DB.prepare(
    `SELECT * FROM clientes ${conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''} ORDER BY nome LIMIT 100`
  );
  const rows = args.length > 0 ? await stmt.bind(...args).all() : await stmt.all();
  return c.json({ data: rows.results });
});

clientes.post('/', async (c) => {
  try {
    const body = schema.parse(await c.req.json());
    const id = `cli_${Math.random().toString(36).slice(2, 10)}`;
    await c.env.DB.prepare(
      `INSERT INTO clientes (id, nome, tipo, cpf_cnpj, doc_extra, email, telefone, endereco, contato, observacoes, honorario_status, honorario_valor, honorario_vencimento, honorario_forma) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, body.nome, body.tipo, body.cpf_cnpj, body.doc_extra, body.email, body.telefone, body.endereco, body.contato, body.observacoes, body.honorario_status, body.honorario_valor, body.honorario_vencimento, body.honorario_forma).run();
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

clientes.patch('/:id', async (c) => {
  try {
    const body = patchSchema.parse(await c.req.json());
    const id = c.req.param('id');
    const row = await c.env.DB.prepare(`SELECT id FROM clientes WHERE id = ?`).bind(id).first();
    if (!row) return c.json({ error: 'not_found', code: 'not_found', requestId: 'cli' }, 404);
    const keys = Object.keys(body) as (keyof typeof body)[];
    await c.env.DB.prepare(`UPDATE clientes SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .bind(...keys.map((k) => body[k]), id).run();
    await audit(c.env.DB, 'portal', 'update', 'cliente', id);
    return c.json({ data: { id, ...body } });
  } catch (e) {
    if (e instanceof z.ZodError) return err(e, 'invalid_cliente', 400);
    return err(e);
  }
});

clientes.delete('/:id', async (c) => {
  const id = c.req.param('id');
  const row = await c.env.DB.prepare(`SELECT id FROM clientes WHERE id = ?`).bind(id).first();
  if (!row) return c.json({ error: 'not_found', code: 'not_found', requestId: 'cli' }, 404);
  const kids = await c.env.DB.prepare(`SELECT COUNT(*) AS n FROM processos WHERE cliente_id = ?`).bind(id).first<{ n: number }>();
  if (kids && kids.n > 0) return c.json({ error: 'has_processos', code: 'has_processos', requestId: 'cli' }, 409);
  await c.env.DB.prepare(`DELETE FROM clientes WHERE id = ?`).bind(id).run();
  await audit(c.env.DB, 'portal', 'delete', 'cliente', id);
  return c.json({ ok: true });
});
