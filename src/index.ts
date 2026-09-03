import { Hono } from 'hono';
import { reqId, err } from './lib/errors';
import { hashPass, requireAuth, audit } from './lib/auth';
import { clientes } from './routes/clientes';

export type Env = { DB: D1Database; DOCS: R2Bucket; ALLOWED_ORIGIN: string };
const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => {
  return c.json({ ok: true, db: 'pending', r2: 'pending', requestId: reqId() });
});

app.use('/api/*', requireAuth as never);
app.route('/api/clientes', clientes as never);
app.post('/api/login', async (c) => {
  try {
    const { email, pass } = await c.req.json() as { email: string; pass: string };
    const u = await c.env.DB.prepare(`SELECT id, pass_hash FROM users WHERE email = ?`).bind(email).first<{ id: string; pass_hash: string }>();
    if (!u || (await hashPass(pass)) !== u.pass_hash) {
      return c.json({ error: 'invalid_credentials', code: 'invalid_credentials', requestId: 'login' }, 401);
    }
    const sid = `ses_${Math.random().toString(36).slice(2, 12)}`;
    const exp = new Date(Date.now() + 12 * 3600e3).toISOString();
    await c.env.DB.prepare(`INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)`).bind(sid, u.id, exp).run();
    await audit(c.env.DB, u.id, 'login', 'session', sid);
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'content-type': 'application/json',
        'set-cookie': `orbis_session=${sid}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=43200`,
      },
    });
  } catch (e) { return err(e, 'login_failed', 500); }
});
app.post('/api/logout', async (c) => {
  const m = (c.req.header('cookie') ?? '').match(/orbis_session=([A-Za-z0-9_-]+)/);
  if (m) await c.env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(m[1]).run();
  return c.json({ ok: true });
});

app.onError((e) => {
  const requestId = reqId();
  console.error(JSON.stringify({ requestId, code: 'unhandled', detail: String(e) }));
  return Response.json({ error: 'internal', code: 'internal', requestId }, { status: 500 });
});

export default app;
