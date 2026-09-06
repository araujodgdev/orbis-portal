// frontend/src/pages/Processos.tsx
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';

type Processo = { id: string; numero_cnj: string; cliente_nome?: string; status: string; fase: string; tribunal?: string };

function spineClass(status: string): string {
  if (status === 'perdido') return 'border-l-seal';
  if (status === 'arquivado') return 'border-l-muted';
  if (status === 'ativo') return 'border-l-brand';
  return 'border-l-amber';
}

function statusBadge(status: string): string {
  if (status === 'perdido') return 'bg-seal-wash text-seal';
  if (status === 'arquivado') return 'border border-line bg-paper text-muted';
  if (status === 'ativo') return 'bg-brand-wash text-brand';
  return 'bg-amber-wash text-amber';
}

const fieldClass =
  'h-11 w-full rounded-sheet border border-line bg-sheet px-3 font-sans text-[15px] text-ink placeholder:text-muted/70 focus:border-brand';

export function Processos() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [fase, setFase] = useState('');
  const [applied, setApplied] = useState({ q: '', status: '', fase: '' });
  const [data, setData] = useState<Processo[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    const params = new URLSearchParams();
    if (applied.q) params.set('q', applied.q);
    if (applied.status) params.set('status', applied.status);
    if (applied.fase) params.set('fase', applied.fase);
    const qs = params.toString();
    api<{ data: Processo[] }>(`/api/processos${qs ? `?${qs}` : ''}`)
      .then((r) => setData(r.data))
      .catch((e) => setError(String(e)));
  }, [applied]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setApplied({ q: q.trim(), status, fase });
  }

  return (
    <main className="w-full">
      <h1 className="font-display text-2xl font-semibold text-brand sm:text-3xl">Processos</h1>
      <div className="mt-1 mb-5 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Busque por CNJ ou nome do cliente.</p>
        <a
          href="/processos/novo"
          className="inline-flex min-h-10 items-center justify-center rounded-stamp bg-brand px-4 text-sm font-semibold text-white transition-colors hover:bg-brand-deep"
        >Novo processo</a>
      </div>
      <form onSubmit={onSearch} className="mb-6 flex flex-col gap-2 lg:flex-row lg:items-center">
        <input
          className={`${fieldClass} lg:flex-1`}
          placeholder="CNJ ou nome do cliente"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar por CNJ ou nome"
        />
        <div className="grid grid-cols-2 gap-2 lg:flex lg:shrink-0">
          <select className={`${fieldClass} lg:w-44`} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar por status">
            <option value="">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="suspenso">Suspenso</option>
            <option value="arquivado">Arquivado</option>
          </select>
          <select className={`${fieldClass} lg:w-44`} value={fase} onChange={(e) => setFase(e.target.value)} aria-label="Filtrar por fase">
            <option value="">Todas as fases</option>
            <option value="conhecimento">Conhecimento</option>
            <option value="execucao">Execução</option>
            <option value="recursal">Recursal</option>
          </select>
        </div>
        <button
          type="submit"
          className="inline-flex h-11 w-full items-center justify-center rounded-sheet border border-brand bg-brand px-5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep lg:w-auto lg:shrink-0"
        >Buscar</button>
      </form>
      {error && <p className="text-seal">Erro ao carregar: {error}</p>}
      {!error && data === null && <p className="text-muted">Carregando…</p>}
      {!error && data !== null && data.length === 0 && <p className="text-muted">Nenhum processo encontrado. Ajuste a busca ou os filtros.</p>}
      {!error && data !== null && data.length > 0 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.map((p, i) => (
            <a
              key={p.id}
              href={`/processos/${encodeURIComponent(p.id)}`}
              className={`block rounded-sheet transition-shadow hover:shadow-lift ${i === 0 && data.length > 2 ? 'sm:col-span-2 xl:col-span-1' : ''}`}
            >
              <article className={`h-full rounded-sheet border border-line border-l-4 bg-sheet p-4 shadow-sheet transition-colors hover:border-brand/30 ${spineClass(p.status)}`}>
                <h2 className="font-display text-[17px] font-semibold text-brand">{p.numero_cnj}</h2>
                <p className="mt-0.5 text-[15px] text-ink">{p.cliente_nome ?? ''}</p>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span className={`rounded-stamp px-2 py-0.5 text-[13px] font-medium ${statusBadge(p.status)}`}>{p.status}</span>
                  <span className="rounded-stamp border border-line bg-paper px-2 py-0.5 text-[13px] text-muted">{p.fase}</span>
                </div>
                {p.tribunal ? <p className="mt-2 text-[13px] text-muted">{p.tribunal}</p> : null}
              </article>
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
