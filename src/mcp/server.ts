import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export type ToolCtx = { db: D1Database; userId: string };

export function buildMcpServer(_ctx: ToolCtx): McpServer {
  const server = new McpServer({ name: 'orbis-mcp', version: '1.0.0' });
  // SDK recente só registra o handler de tools/list após a primeira tool;
  // sem isto o servidor vazio responde -32601 em vez de { tools: [] }.
  // Idempotente: futuros registerTool() continuam a funcionar (o handler
  // lê o registo de tools ao vivo).
  (server as unknown as { setToolRequestHandlers(): void }).setToolRequestHandlers();
  return server;
}
