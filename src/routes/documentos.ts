// src/routes/documentos.ts
import { Hono } from 'hono';
import { audit } from '../lib/auth';
import { err } from '../lib/errors';
import type { Env } from '../index';

export const documentos = new Hono<{ Bindings: Env }>();

documentos.post('/processo/:pid', async (c) => {
  try {
    const form = await c.req.formData();
    const file = form.get('file') as unknown as File | null;
    const titulo = String(form.get('titulo') ?? 'documento');
    const rascunho = form.get('rascunho') === '0' ? 0 : 1;
    if (!file || file.size === 0) return c.json({ error: 'missing_file', code: 'missing_file', requestId: 'doc' }, 400);
    if (file.size > 10 * 1024 * 1024) return c.json({ error: 'too_large', code: 'too_large', requestId: 'doc' }, 413);
    const pid = c.req.param('pid');
    const key = `processo/${pid}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.pdf`;
    await c.env.DOCS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: 'application/pdf' } });
    const id = `doc_${Math.random().toString(36).slice(2, 10)}`;
    await c.env.DB.prepare(`INSERT INTO documentos (id, processo_id, titulo, r2_key, rascunho) VALUES (?, ?, ?, ?, ?)`)
      .bind(id, pid, titulo.slice(0, 120), key, rascunho).run();
    await audit(c.env.DB, 'portal', 'create', 'documento', id);
    return c.json({ data: { id, r2_key: key } }, 201);
  } catch (e) { return err(e, 'upload_failed', 500); }
});

documentos.get('/:id/download', async (c) => {
  const row = await c.env.DB.prepare(`SELECT r2_key FROM documentos WHERE id = ?`).bind(c.req.param('id')).first<{ r2_key: string }>();
  if (!row) return c.json({ error: 'not_found', code: 'not_found', requestId: 'doc' }, 404);
  const obj = await c.env.DOCS.get(row.r2_key);
  if (!obj) return c.json({ error: 'missing_object', code: 'missing_object', requestId: 'doc' }, 404);
  return new Response(obj.body, { headers: { 'content-type': 'application/pdf', 'cache-control': 'private, max-age=60' } });
});
