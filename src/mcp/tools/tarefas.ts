import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolCtx } from '../server';
import { tool } from '../server';
import { schema as tarefaSchema } from '../../routes/tarefas';

const tarefaPatchBase = z.object({
  titulo: z.string().min(2).max(200).optional(),
  responsavel: z.string().max(120).optional(),
  vencimento: z.string().min(8).max(10).optional(),
  status: z.enum(['aberta', 'concluida']).optional(),
});
const tarefaPatch = tarefaPatchBase.refine((b) => Object.keys(b).length > 0, 'Nada para atualizar');

function parseOrThrow<T>(run: () => T): T {
  try {
    return run();
  } catch (e) {
    if (e instanceof z.ZodError) throw new Error(`Dados inválidos: ${e.issues[0]?.message ?? 'verifique os campos'}`);
    throw e;
  }
}

export function registerTarefas(server: McpServer, ctx: ToolCtx): void {
  tool(server, ctx, 'list_tarefas', 'Lista tarefas por vencimento', {}, async () => {
    const rows = await ctx.db.prepare(`SELECT * FROM tarefas ORDER BY vencimento ASC LIMIT 100`).all();
    return rows.results;
  });

  tool(server, ctx, 'create_tarefa', 'Cadastra tarefa do processo', tarefaSchema.shape, async (args) => {
    const body = parseOrThrow(() => tarefaSchema.parse(args));
    const id = `tar_${Math.random().toString(36).slice(2, 10)}`;
    await ctx.db.prepare(`INSERT INTO tarefas (id, processo_id, titulo, responsavel, vencimento) VALUES (?, ?, ?, ?, ?)`)
      .bind(id, body.processo_id, body.titulo, body.responsavel, body.vencimento).run();
    return { id, ...body };
  });

  tool(server, ctx, 'update_tarefa', 'Atualiza título, responsável, vencimento ou status da tarefa', {
    id: z.string(), ...tarefaPatchBase.shape,
  }, async (args) => {
    const { id, ...rest } = args as Record<string, unknown> & { id: unknown };
    const body = parseOrThrow(() => tarefaPatch.parse(rest));
    const row = await ctx.db.prepare(`SELECT id FROM tarefas WHERE id = ?`).bind(String(id)).first();
    if (!row) throw new Error('Tarefa não encontrada.');
    const keys = Object.keys(body) as (keyof typeof body)[];
    await ctx.db.prepare(`UPDATE tarefas SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .bind(...keys.map((k) => body[k]), String(id)).run();
    return { id, ...body };
  });
}
