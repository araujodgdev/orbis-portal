import { Hono } from 'hono';
import { reqId } from './lib/errors';

export type Env = { DB: D1Database; DOCS: R2Bucket; ALLOWED_ORIGIN: string };
const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => {
  return c.json({ ok: true, db: 'pending', r2: 'pending', requestId: reqId() });
});

app.onError((e) => {
  const requestId = reqId();
  console.error(JSON.stringify({ requestId, code: 'unhandled', detail: String(e) }));
  return Response.json({ error: 'internal', code: 'internal', requestId }, { status: 500 });
});

export default app;
