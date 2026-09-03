import { Hono } from 'hono';
import { reqId, err } from './lib/errors';
import { hashPass, requireAuth, audit } from './lib/auth';
import { clientes } from './routes/clientes';
import { processos } from './routes/processos';
import { movimentacoes } from './routes/movimentacoes';
import { prazos } from './routes/prazos';
import { dashboard } from './routes/dashboard';
import { documentos } from './routes/documentos';
import { tarefas } from './routes/tarefas';
import { jobs } from './routes/jobs';
import { noticias } from './routes/noticias';
import { csvImport } from './routes/csv';

export type Env = { DB: D1Database; DOCS: R2Bucket; ALLOWED_ORIGIN: string; ASSETS: { fetch: typeof fetch } };
const app = new Hono<{ Bindings: Env }>();

app.get('/api/health', (c) => {
  return c.json({ ok: true, db: 'pending', r2: 'pending', requestId: reqId() });
});

app.use('/api/*', requireAuth as never);
app.route('/api/clientes', clientes as never);
app.route('/api/processos', processos as never);
app.route('/api/movimentacoes', movimentacoes as never);
app.route('/api/prazos', prazos as never);
app.route('/api/dashboard', dashboard as never);
app.route('/api/documentos', documentos as never);
app.route('/api/processos-docs', documentos as never);
app.route('/api/tarefas', tarefas as never);
app.route('/api/jobs', jobs as never);
app.route('/api/noticias', noticias as never);
app.route('/api/import', csvImport as never);
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
    // Secure só sob https (prod); em http local o navegador descartaria o cookie e o login nunca grudaria.
    const secure = new URL(c.req.url).protocol === 'https:' ? '; Secure' : '';
    return new Response(JSON.stringify({ ok: true }), {
      headers: {
        'content-type': 'application/json',
        'set-cookie': `orbis_session=${sid}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=43200`,
      },
    });
  } catch (e) { return err(e, 'login_failed', 500); }
});
app.post('/api/logout', async (c) => {
  const m = (c.req.header('cookie') ?? '').match(/orbis_session=([A-Za-z0-9_-]+)/);
  if (m) await c.env.DB.prepare(`DELETE FROM sessions WHERE id = ?`).bind(m[1]).run();
  return c.json({ ok: true });
});

// SPA fallback: /api/* desconhecido continua 404 JSON; qualquer outra rota
// serve o index.html (cobre o `wrangler dev` local, onde o not_found_handling
// do assets nem sempre é aplicado).
app.notFound((c) => {
  if (c.req.path.startsWith('/api/')) {
    return Response.json({ error: 'not_found', code: 'not_found', requestId: reqId() }, { status: 404 });
  }
  const assets = (c.env as Partial<Env>).ASSETS;
  if (!assets) return c.text('Not Found', 404);
  return assets.fetch(new Request(new URL('/index.html', c.req.url)));
});

app.onError((e) => {  const requestId = reqId();
  console.error(JSON.stringify({ requestId, code: 'unhandled', detail: String(e) }));
  return Response.json({ error: 'internal', code: 'internal', requestId }, { status: 500 });
});

export default app;
