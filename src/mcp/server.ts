import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { z } from 'zod';
import { audit } from '../lib/auth';
import { registerProcessos } from './tools/processos';
import { registerClientes } from './tools/clientes';
import { registerPrazos } from './tools/prazos';
import { registerTarefas } from './tools/tarefas';
import { registerDashboard } from './tools/dashboard';

export type ToolCtx = { db: D1Database; userId: string };

export function tool(
  server: McpServer,
  ctx: ToolCtx,
  name: string,
  description: string,
  shape: Record<string, z.ZodTypeAny>,
  run: (args: Record<string, unknown>) => Promise<unknown>,
): void {
  server.registerTool(name, { description, inputSchema: shape }, async (args) => {
    try {
      const data = await run(args as Record<string, unknown>);
      await audit(ctx.db, ctx.userId, `mcp.${name}`, 'mcp', name, {});
      return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
    } catch (e) {
      return { content: [{ type: 'text' as const, text: e instanceof Error ? e.message : String(e) }], isError: true };
    }
  });
}

export function buildMcpServer(ctx: ToolCtx): McpServer {
  const server = new McpServer({ name: 'orbis-mcp', version: '1.0.0' });
  // SDK recente só registra o handler de tools/list após a primeira tool;
  // sem isto o servidor vazio responde -32601 em vez de { tools: [] }.
  // Idempotente: futuros registerTool() continuam a funcionar (o handler
  // lê o registo de tools ao vivo).
  (server as unknown as { setToolRequestHandlers(): void }).setToolRequestHandlers();
  registerProcessos(server, ctx);
  registerClientes(server, ctx);
  registerPrazos(server, ctx);
  registerTarefas(server, ctx);
  registerDashboard(server, ctx);
  return server;
}
