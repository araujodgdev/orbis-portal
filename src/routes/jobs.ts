// src/routes/jobs.ts
import { Hono } from 'hono';
import { z } from 'zod';
import { err } from '../lib/errors';
import type { Env } from '../index';

export const jobs = new Hono<{ Bindings: Env }>();
const schema = z.object({ tipo: z.string().min(2).max(40), payload: z.record(z.unknown()).default({}) });

jobs.post('/', async (c) => {
  try {
    const parsed = schema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: 'invalid_job', code: 'invalid_job', requestId: 'job' }, 400);
    const body = parsed.data;
    const id = `job_${Math.random().toString(36).slice(2, 10)}`;
    await c.env.DB.prepare(`INSERT INTO jobs (id, tipo, payload_json, status) VALUES (?, ?, ?, 'queued')`)
      .bind(id, body.tipo, JSON.stringify(body.payload)).run();
    return c.json({ data: { id, status: 'queued' } }, 201);
  } catch (e) { return err(e, 'invalid_job', 400); }
});

jobs.patch('/:id', async (c) => {
  const { status } = await c.req.json() as { status: string };
  if (!['queued', 'running', 'done', 'error'].includes(status)) {
    return c.json({ error: 'invalid_status', code: 'invalid_status', requestId: 'job' }, 400);
  }
  await c.env.DB.prepare(`UPDATE jobs SET status = ? WHERE id = ?`).bind(status, c.req.param('id')).run();
  return c.json({ ok: true });
});

jobs.get('/', async (c) => {
  const rows = await c.env.DB.prepare(`SELECT * FROM jobs ORDER BY created_at DESC LIMIT 50`).all();
  return c.json({ data: rows.results });
});
