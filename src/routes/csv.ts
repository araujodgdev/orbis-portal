// src/routes/csv.ts
import { Hono } from 'hono';
import { isCNJ } from '../lib/validate';
import type { Env } from '../index';

export const csvImport = new Hono<{ Bindings: Env }>();

csvImport.post('/processos', async (c) => {
  const text = await c.req.text();
  if (text.length > 200_000) return c.json({ error: 'too_large', code: 'too_large', requestId: 'csv' }, 413);
  const lines = text.trim().split('\n');
  const header = (lines.shift() ?? '').split(',').map((s) => s.trim());
  const idx = (k: string) => header.indexOf(k);
  const report: Array<{ line: number; ok: boolean; error?: string }> = [];
  let ok = 0;
  for (let i = 0; i < lines.length; i++) {
    const cols = lines[i].split(',').map((s) => s.trim());
    const cnj = cols[idx('numero_cnj')] ?? '';
    const trib = cols[idx('tribunal')] ?? '';
    const fase = cols[idx('fase')] ?? 'conhecimento';
    const cliId = cols[idx('cliente_id')] ?? '';
    if (!isCNJ(cnj)) { report.push({ line: i + 2, ok: false, error: 'CNJ inválido' }); continue; }
    if (!cliId) { report.push({ line: i + 2, ok: false, error: 'cliente_id ausente' }); continue; }
    try {
      const id = `pro_${Math.random().toString(36).slice(2, 10)}`;
      await c.env.DB.prepare(
        `INSERT INTO processos (id, cliente_id, numero_cnj, tribunal, fase) VALUES (?, ?, ?, ?, ?)`
      ).bind(id, cliId, cnj, trib, fase).run();
      ok++;
      report.push({ line: i + 2, ok: true });
    } catch {
      report.push({ line: i + 2, ok: false, error: 'CNJ duplicado ou cliente inexistente' });
    }
  }
  return c.json({ ok, total: lines.length, report });
});
