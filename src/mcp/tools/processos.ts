import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { ToolCtx } from '../server';
import { tool } from '../server';
import { schema as processoSchema } from '../../routes/processos';

const processoPatchBase = z.object({
  fase: z.string().max(40).optional(),
  responsavel: z.string().max(120).optional(),
  area: z.string().max(40).optional(),
  tribunal: z.string().max(20).optional(),
  status: z.enum(['ativo', 'arquivado']).optional(),
});
const processoPatch = processoPatchBase.refine((b) => Object.keys(b).length > 0, 'Nada para atualizar');

function parseOrThrow<T>(run: () => T): T {
  try {
    return run();
  } catch (e) {
    if (e instanceof z.ZodError) throw new Error(`Dados inválidos: ${e.issues[0]?.message ?? 'verifique os campos'}`);
    throw e;
  }
}

export function registerProcessos(server: McpServer, ctx: ToolCtx): void {
  tool(server, ctx, 'search_processos', 'Busca processos por CNJ, status ou fase', {
    q: z.string().optional(), status: z.string().optional(), fase: z.string().optional(),
  }, async (args) => {
    let sql = `SELECT p.*, cl.nome AS cliente_nome FROM processos p JOIN clientes cl ON cl.id = p.cliente_id WHERE 1=1`;
    const bind: string[] = [];
    if (args.q) { const qEsc = String(args.q).replace(/[%_\\]/g, (m) => '\\' + m); sql += ` AND (p.numero_cnj LIKE ? ESCAPE '\\' OR cl.nome LIKE ? ESCAPE '\\')`; bind.push(`%${qEsc}%`, `%${qEsc}%`); }
    if (args.status) { sql += ` AND p.status = ?`; bind.push(String(args.status)); }
    if (args.fase) { sql += ` AND p.fase = ?`; bind.push(String(args.fase)); }
    sql += ` ORDER BY p.created_at DESC LIMIT 100`;
    const rows = await ctx.db.prepare(sql).bind(...bind).all();
    return rows.results;
  });

  tool(server, ctx, 'get_processo', 'Ficha completa do processo', {
    id: z.string(),
  }, async (args) => {
    const id = String(args.id);
    const p = await ctx.db.prepare(`SELECT * FROM processos WHERE id = ?`).bind(id).first();
    if (!p) throw new Error('Processo não encontrado.');
    const movs = await ctx.db.prepare(`SELECT * FROM movimentacoes WHERE processo_id = ? ORDER BY data DESC LIMIT 100`).bind(id).all();
    const prz = await ctx.db.prepare(`SELECT * FROM prazos WHERE processo_id = ? ORDER BY data ASC LIMIT 100`).bind(id).all();
    const docs = await ctx.db.prepare(`SELECT id, titulo, rascunho, created_at FROM documentos WHERE processo_id = ? ORDER BY created_at DESC LIMIT 100`).bind(id).all();
    return { data: p, movimentacoes: movs.results, prazos: prz.results, documentos: docs.results };
  });

  tool(server, ctx, 'create_processo', 'Cadastra processo com CNJ e vínculo ao cliente', processoSchema.shape, async (args) => {
    const body = parseOrThrow(() => processoSchema.parse(args));
    const id = `pro_${Math.random().toString(36).slice(2, 10)}`;
    await ctx.db.prepare(
      `INSERT INTO processos (id, cliente_id, numero_cnj, tribunal, fase, responsavel, area) VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, body.cliente_id, body.numero_cnj, body.tribunal, body.fase, body.responsavel, body.area).run();
    return { id, ...body };
  });

  tool(server, ctx, 'update_processo', 'Atualiza fase, responsável, área, tribunal ou status do processo', {
    id: z.string(), ...processoPatchBase.shape,
  }, async (args) => {
    const { id, ...rest } = args as Record<string, unknown> & { id: unknown };
    const body = parseOrThrow(() => processoPatch.parse(rest));
    const row = await ctx.db.prepare(`SELECT id FROM processos WHERE id = ?`).bind(String(id)).first();
    if (!row) throw new Error('Processo não encontrado.');
    const keys = Object.keys(body) as (keyof typeof body)[];
    await ctx.db.prepare(`UPDATE processos SET ${keys.map((k) => `${k} = ?`).join(', ')} WHERE id = ?`)
      .bind(...keys.map((k) => body[k]), String(id)).run();
    return { id, ...body };
  });
}
