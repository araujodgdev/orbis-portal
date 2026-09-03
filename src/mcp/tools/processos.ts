import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolCtx } from '../server';
import { tool } from '../server';

export function registerProcessos(server: McpServer, ctx: ToolCtx): void {
  tool(server, ctx, 'search_processos', 'Busca processos por CNJ, status ou fase', {
    q: z.string().optional(), status: z.string().optional(), fase: z.string().optional(),
  }, async (args) => {
    let sql = `SELECT p.*, cl.nome AS cliente_nome FROM processos p JOIN clientes cl ON cl.id = p.cliente_id WHERE 1=1`;
    const bind: string[] = [];
    if (args.q) { sql += ` AND (p.numero_cnj LIKE ? OR cl.nome LIKE ?)`; bind.push(`%${args.q}%`, `%${args.q}%`); }
    if (args.status) { sql += ` AND p.status = ?`; bind.push(String(args.status)); }
    if (args.fase) { sql += ` AND p.fase = ?`; bind.push(String(args.fase)); }
    sql += ` ORDER BY p.created_at DESC LIMIT 100`;
    const rows = await ctx.db.prepare(sql).bind(...bind).all();
    return rows.results;
  });

  tool(server, ctx, 'get_processo', 'Ficha completa do processo', {
    id: z.string(),
  }, async (args) => {
    const p = await ctx.db.prepare(`SELECT * FROM processos WHERE id = ?`).bind(String(args.id)).first();
    if (!p) throw new Error('Processo não encontrado.');
    return p;
  });
}
