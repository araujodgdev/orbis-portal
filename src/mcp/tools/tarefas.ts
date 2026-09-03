import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolCtx } from '../server';
import { tool } from '../server';

export function registerTarefas(server: McpServer, ctx: ToolCtx): void {
  tool(server, ctx, 'list_tarefas', 'Lista tarefas por vencimento', {}, async () => {
    const rows = await ctx.db.prepare(`SELECT * FROM tarefas ORDER BY vencimento ASC LIMIT 100`).all();
    return rows.results;
  });
}
