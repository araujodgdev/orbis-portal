import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolCtx } from '../server';
import { tool } from '../server';
import { schema as clienteSchema } from '../../routes/clientes';

const clientePatchBase = clienteSchema.partial();
const clientePatch = clientePatchBase.refine((b) => Object.keys(b).length > 0, 'Nada para atualizar');

function parseOrThrow<T>(run: () => T): T {
  try {
    return run();
  } catch (e) {
    if (e instanceof z.ZodError) throw new Error(`Dados inválidos: ${e.issues[0]?.message ?? 'verifique os campos'}`);
    throw e;
  }
}

export function registerClientes(server: McpServer, ctx: ToolCtx): void {
  tool(server, ctx, 'search_clientes', 'Busca clientes por nome', {
    q: z.string().optional(),
  }, async (args) => {
    const conds: string[] = [];
    const bind: string[] = [];
    if (args.q) { conds.push(`nome LIKE ?`); bind.push(`%${args.q}%`); }
    const stmt = ctx.db.prepare(
      `SELECT * FROM clientes ${conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''} ORDER BY nome LIMIT 100`
    );
    const rows = bind.length > 0 ? await stmt.bind(...bind).all() : await stmt.all();
    return rows.results;
  });

  tool(server, ctx, 'get_cliente', 'Ficha completa do cliente com seus processos', {
    id: z.string(),
  }, async (args) => {
    const row = await ctx.db.prepare(`SELECT * FROM clientes WHERE id = ?`).bind(String(args.id)).first();
    if (!row) throw new Error('Cliente não encontrado.');
    const procs = await ctx.db.prepare(`SELECT id, numero_cnj, fase, status FROM processos WHERE cliente_id = ? LIMIT 50`)
      .bind(String(args.id)).all();
    return { data: row, processos: procs.results };
  });

  tool(server, ctx, 'create_cliente', 'Cadastra cliente com ficha completa', clienteSchema.shape, async (args) => {
    const body = parseOrThrow(() => clienteSchema.parse(args));
    const id = `cli_${Math.random().toString(36).slice(2, 10)}`;
    await ctx.db.prepare(
      `INSERT INTO clientes (id, nome, tipo, cpf_cnpj, doc_extra, email, telefone, endereco, contato, observacoes, honorario_status, honorario_valor, honorario_vencimento, honorario_forma) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, body.nome, body.tipo, body.cpf_cnpj, body.doc_extra, body.email, body.telefone, body.endereco, body.contato, body.observacoes, body.honorario_status, body.honorario_valor, body.honorario_vencimento, body.honorario_forma).run();
    return { id, ...body };
  });

  tool(server, ctx, 'update_cliente', 'Atualiza a ficha do cliente', {
    id: z.string(), ...clientePatchBase.shape,
  }, async (args) => {
    const { id, ...rest } = args as Record<string, unknown> & { id: unknown };
    const body = parseOrThrow(() => clientePatch.parse(rest));
    const row = await ctx.db.prepare(`SELECT id FROM clientes WHERE id = ?`).bind(String(id)).first();
    if (!row) throw new Error('Cliente não encontrado.');
    const keys = Object.keys(body) as (keyof typeof body)[];
    await ctx.db.prepare(`UPDATE clientes SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .bind(...keys.map((k) => body[k]), String(id)).run();
    return { id, ...body };
  });

  tool(server, ctx, 'delete_cliente', 'Remove o cliente (bloqueado se houver processos vinculados)', {
    id: z.string(),
  }, async (args) => {
    const id = String(args.id);
    const row = await ctx.db.prepare(`SELECT id FROM clientes WHERE id = ?`).bind(id).first();
    if (!row) throw new Error('Cliente não encontrado.');
    const kids = await ctx.db.prepare(`SELECT COUNT(*) AS n FROM processos WHERE cliente_id = ?`).bind(id).first<{ n: number }>();
    if (kids && kids.n > 0) throw new Error('Este cliente tem processos vinculados.');
    await ctx.db.prepare(`DELETE FROM clientes WHERE id = ?`).bind(id).run();
    return { ok: true };
  });
}
