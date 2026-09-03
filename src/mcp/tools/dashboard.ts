import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolCtx } from '../server';
import { tool } from '../server';

export function registerDashboard(server: McpServer, ctx: ToolCtx): void {
  tool(server, ctx, 'get_dashboard', 'Resumo do escritório: prazos próximos, movimentações não lidas e processos em risco', {}, async () => {
    const today = new Date();
    const in7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const hoje = today.toISOString().slice(0, 10);
    const p7 = await ctx.db.prepare(
      `SELECT z.*, p.numero_cnj FROM prazos z JOIN processos p ON p.id = z.processo_id WHERE z.status = 'aberto' AND z.data <= ? ORDER BY z.data ASC LIMIT 50`
    ).bind(in7).all();
    const naoLidas = await ctx.db.prepare(
      `SELECT m.*, p.numero_cnj FROM movimentacoes m JOIN processos p ON p.id = m.processo_id WHERE m.lida = 0 ORDER BY m.data DESC LIMIT 50`
    ).all();
    const risco = await ctx.db.prepare(
      `SELECT DISTINCT p.id, p.numero_cnj, p.fase FROM processos p
       LEFT JOIN prazos z ON z.processo_id = p.id AND z.status IN ('aberto','perdido')
       LEFT JOIN movimentacoes m ON m.processo_id = p.id AND m.lida = 0
       WHERE z.status = 'perdido' OR z.data <= date(?, '+3 days') OR m.data <= date(?, '-1 day')
       LIMIT 50`
    ).bind(hoje, hoje).all();
    return { prazos7d: p7.results, naoLidas: naoLidas.results, risco: risco.results };
  });
}
