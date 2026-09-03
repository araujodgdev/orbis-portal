import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolCtx } from '../server';
import { tool } from '../server';
import { schema as prazoSchema } from '../../routes/prazos';

const STATUS = ['aberto', 'cumprido', 'perdido'] as const;

function parseOrThrow<T>(run: () => T): T {
  try {
    return run();
  } catch (e) {
    if (e instanceof z.ZodError) throw new Error(`Dados inválidos: ${e.issues[0]?.message ?? 'verifique os campos'}`);
    throw e;
  }
}

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

  tool(server, ctx, 'create_prazo', 'Cadastra prazo do processo', {
    processo_id: z.string().min(3), ...prazoSchema.shape,
  }, async (args) => {
    const { processo_id, ...rest } = args as Record<string, unknown> & { processo_id: unknown };
    const body = parseOrThrow(() => prazoSchema.parse(rest));
    const id = `prz_${Math.random().toString(36).slice(2, 10)}`;
    await ctx.db.prepare(`INSERT INTO prazos (id, processo_id, data, tipo) VALUES (?, ?, ?, ?)`)
      .bind(id, String(processo_id), body.data, body.tipo).run();
    return { id, processo_id, ...body };
  });

  tool(server, ctx, 'update_prazo_status', 'Atualiza o status do prazo', {
    id: z.string(), status: z.string(),
  }, async (args) => {
    const status = String(args.status);
    if (!(STATUS as readonly string[]).includes(status)) {
      throw new Error('Status inválido. Use aberto, cumprido ou perdido.');
    }
    await ctx.db.prepare(`UPDATE prazos SET status = ? WHERE id = ?`).bind(status, String(args.id)).run();
    return { ok: true };
  });
}
