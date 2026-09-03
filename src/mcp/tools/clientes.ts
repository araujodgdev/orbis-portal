import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolCtx } from '../server';
import { tool } from '../server';

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
}
