// src/routes/clientes.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { audit } from '../lib/auth';
import { err } from '../lib/errors';
import type { Env } from '../index';

export const schema = z.object({
  nome: z.string().min(2).max(120),
  contato: z.string().max(200).default(''),
  honorario_status: z.string().max(40).default('ativo'),
  cpf_cnpj: z.string().max(18).default(''),
});

export const clientes = new Hono<{ Bindings: Env }>();

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
    await c.env.DB.prepare(`INSERT INTO clientes (id, nome, contato, honorario_status, cpf_cnpj) VALUES (?, ?, ?, ?, ?)`)
      .bind(id, body.nome, body.contato, body.honorario_status, body.cpf_cnpj).run();
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
