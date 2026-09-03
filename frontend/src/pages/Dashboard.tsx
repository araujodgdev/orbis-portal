// frontend/src/pages/Dashboard.tsx
import { useEffect, useState, type ReactNode } from 'react';
import { api } from '../lib/api';

export function riskLabel(p: { status: string }): string {
  if (p.status === 'perdido') return 'Perdido';
  if (p.status === 'aberto') return 'Urgente';
  return 'Aberto';
}

type Dash = { prazos7d: Array<{ id: string; data: string; tipo: string; numero_cnj?: string; processo_id?: string }>; naoLidas: Array<{ id: string; texto: string; data: string; processo_id?: string }>; risco: Array<{ id: string; numero_cnj: string }> };

// Linha clicável quando há destino; texto estático quando não há.
function ItemLink({ href, children, className = '' }: { href?: string; children: ReactNode; className?: string }) {
  if (!href) return <span className={className}>{children}</span>;
  return <a href={href} className={`cursor-pointer ${className}`}>{children}</a>;
}

export function Dashboard() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<{ prazos7d: Dash['prazos7d']; naoLidas: Dash['naoLidas']; risco: Dash['risco'] }>('/api/dashboard')
      .then((d) => setData(d as Dash)).catch((e) => setError(String(e)));
  }, []);
  if (error) return <main><p className="text-[15px] text-ink">Erro ao carregar: {error}</p></main>;
  if (!data) return <main><p className="text-[15px] text-ink">Carregando…</p></main>;
  return (
    <main>
      <h1 className="font-display text-2xl font-semibold text-brand sm:text-3xl">Hoje no escritório</h1>
      <p className="mt-1 text-sm text-muted">Prazos, movimentações e riscos num só olhar.</p>

      <dl className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
        <div className="flex flex-col rounded-sheet border border-line bg-sheet px-3 py-3 shadow-sheet">
          <dt className="text-xs leading-snug text-muted sm:text-sm">Prazos 7 dias</dt>
          <dd className="mt-1 font-display text-2xl leading-none text-brand">{data.prazos7d.length}</dd>
        </div>
        <div className="flex flex-col rounded-sheet border border-line bg-amber-wash/60 px-3 py-3">
          <dt className="text-xs leading-snug text-muted sm:text-sm">Não lidas</dt>
          <dd className="mt-1 font-display text-2xl leading-none text-amber">{data.naoLidas.length}</dd>
        </div>
        <div className="flex flex-col rounded-sheet border border-seal/25 bg-seal-wash/60 px-3 py-3">
          <dt className="text-xs leading-snug text-muted sm:text-sm">Risco</dt>
          <dd className="mt-1 font-display text-2xl leading-none text-seal">{data.risco.length}</dd>
        </div>
      </dl>

      <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
        <section className="min-w-0 rounded-panel border border-line bg-sheet shadow-sheet">
          <h2 className="border-b border-line px-4 pt-4 pb-3 font-display text-lg text-ink">Prazos 7 dias ({data.prazos7d.length})</h2>
          {data.prazos7d.length === 0 && <p className="px-4 py-3 text-sm text-muted">Nenhum prazo próximo.</p>}
          <ul className="divide-y divide-line">{data.prazos7d.map((p) => (
            <li key={p.id} className="px-4 py-2.5 text-[15px] leading-relaxed text-ink">
              <ItemLink
                href={p.processo_id ? `/processos/${encodeURIComponent(p.processo_id)}` : undefined}
                className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-stamp transition-colors hover:bg-brand-wash/60"
              >
                <span className="rounded-stamp bg-brand-wash px-1.5 py-0.5 text-xs font-semibold text-brand">{p.data}</span>
                <span>{p.tipo}</span>
                <span className="text-sm text-muted">{p.numero_cnj ?? ''}</span>
              </ItemLink>
            </li>))}
          </ul>
        </section>
        <section className="min-w-0 rounded-sheet border border-line bg-amber-wash/50">
          <h2 className="border-b border-line px-4 pt-4 pb-3 font-display text-lg text-ink">Não lidas ({data.naoLidas.length})</h2>
          <ul className="divide-y divide-line">{data.naoLidas.map((m) => (
            <li key={m.id} className="space-y-2 px-4 py-3">
              <span className="inline-block rounded-stamp bg-sheet px-1.5 py-0.5 text-xs font-medium text-muted">{m.data}</span>
              <ItemLink
                href={m.processo_id ? `/processos/${encodeURIComponent(m.processo_id)}` : undefined}
                className="block rounded-stamp transition-colors hover:bg-sheet"
              >
                <p className="text-[15px] leading-relaxed text-ink">{m.texto.slice(0, 80)}</p>
              </ItemLink>
              <button
                className="min-h-9 cursor-pointer rounded-stamp bg-brand px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-deep"
                onClick={() => api(`/api/movimentacoes/${m.id}/lida`, { method: 'PATCH' }).then(() => location.reload())}>Marcar lida</button>
            </li>))}
          </ul>
        </section>
        <section className="min-w-0 rounded-sheet border border-seal/25 bg-seal-wash/60">
          <h2 className="border-b border-seal/15 px-4 pt-4 pb-3 font-display text-lg text-ink">Risco ({data.risco.length})</h2>
          <ul className="divide-y divide-seal/15">{data.risco.map((r) => (
            <li key={r.id} className="px-4 py-2.5 text-[15px] text-ink">
              <ItemLink
                href={`/processos/${encodeURIComponent(r.id)}`}
                className="flex items-center gap-2 rounded-stamp transition-colors hover:bg-seal-wash"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-seal" />
                <span>{r.numero_cnj}</span>
              </ItemLink>
            </li>))}
          </ul>
        </section>
      </div>
    </main>
  );
}
