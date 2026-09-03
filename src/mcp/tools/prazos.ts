import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolCtx } from '../server';
import { tool } from '../server';

const STATUS = ['aberto', 'cumprido', 'perdido'] as const;

export function registerPrazos(server: McpServer, ctx: ToolCtx): void {
  tool(server, ctx, 'list_prazos', 'Lista prazos por status ou processo', {
    status: z.string().optional(), processo_id: z.string().optional(),
  }, async (args) => {
    if (args.status && !(STATUS as readonly string[]).includes(String(args.status))) {
      throw new Error('Status inválido. Use aberto, cumprido ou perdido.');
    }
    const conds: string[] = [];
    const bind: string[] = [];
    if (args.status) { conds.push(`status = ?`); bind.push(String(args.status)); }
    if (args.processo_id) { conds.push(`processo_id = ?`); bind.push(String(args.processo_id)); }
    const rows = await ctx.db.prepare(
      `SELECT * FROM prazos ${conds.length > 0 ? `WHERE ${conds.join(' AND ')}` : ''} ORDER BY data ASC LIMIT 100`
    ).bind(...bind).all();
    return rows.results;
  });
}
