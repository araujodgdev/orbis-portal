// frontend/src/pages/FichaProcesso.tsx
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Ficha = {
  data: { numero_cnj: string };
  movimentacoes: Array<{ id: string; data: string; texto: string }>;
  prazos: Array<{ id: string; data: string; tipo: string; status: string }>;
  documentos: Array<{ id: string; titulo: string }>;
};

export function FichaProcesso({ id }: { id: string }) {
  const [d, setD] = useState<null | Ficha>(null);
  const [error, setError] = useState('');
  useEffect(() => { api(`/api/processos/${id}`).then(setD as never).catch((e) => setError(String(e))); }, [id]);
  if (error) return (
    <main className="font-sans text-ink">
      <p>Erro ao carregar ficha: {error}</p>
      <p><a href="/processos" className="text-brand underline underline-offset-2 hover:text-brand-deep">Voltar para processos</a></p>
    </main>
  );
  if (!d) return <p className="font-sans text-ink">Carregando ficha…</p>;
  return (
    <main className="font-sans text-ink">
      <a href="/processos" className="text-sm text-brand underline-offset-2 hover:text-brand-deep hover:underline">
        Voltar para processos
      </a>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-display text-2xl font-semibold text-brand sm:text-3xl">{d.data.numero_cnj}</h1>
        <a
          href={`/processos/${encodeURIComponent(id)}/editar`}
          className="inline-flex min-h-10 items-center justify-center rounded-stamp border border-line bg-sheet px-4 text-sm font-semibold text-brand transition-colors hover:border-brand/40 hover:text-brand-deep"
        >Editar</a>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <section aria-label="Movimentações" className="rounded-sheet border border-line bg-sheet p-5 shadow-sheet sm:p-6">
          <h2 className="font-display text-xl font-semibold">Movimentações</h2>
          {d.movimentacoes.length === 0 && <p className="mt-2 text-muted">Nenhuma movimentação registrada.</p>}
          {d.movimentacoes.length > 0 && (
            <ul className="mt-4">
              {d.movimentacoes.map((m) => (
                <li key={m.id} className="relative ml-1.5 border-l-2 border-line pb-5 pl-6 last:pb-0">
                  <span aria-hidden="true" className="absolute top-1.5 -left-[7px] h-3 w-3 rounded-full border-2 border-white bg-brand ring-1 ring-line" />
                  <span className="block text-[13px] text-muted">{m.data}</span>
                  <span className="block text-[15px] leading-relaxed">{m.texto}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="grid content-start gap-5">
          <section aria-label="Pedir minuta" className="rounded-panel bg-brand-deep p-5 text-white">
            <p className="text-sm leading-relaxed text-white/70">Disponível com Hermes — sub-projeto 3</p>
            <button
              title="Disponível com Hermes — sub-projeto 3"
              className="mt-3 min-h-10 w-full cursor-pointer rounded-sheet bg-white px-4 py-2.5 text-[15px] font-semibold text-brand-deep transition-colors hover:bg-brand-wash"
              onClick={() => api('/api/jobs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tipo: 'minuta', payload: { processo_id: id } }) }).then(() => alert('Pedido enfileirado (Hermes plugado no sub-projeto 3).'))}
            >Pedir minuta</button>
          </section>

          <section aria-label="Prazos" className="rounded-sheet border border-line border-l-4 border-l-amber bg-sheet p-5">
            <h2 className="font-display text-xl font-semibold">Prazos</h2>
            {d.prazos.length === 0 && <p className="mt-2 text-muted">Nenhum prazo em aberto.</p>}
            {d.prazos.length > 0 && (
              <ul className="mt-2 divide-y divide-line">
                {d.prazos.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                    <span className="text-sm text-muted">{p.data}</span>
                    <span className="text-[15px] font-medium">{p.tipo}</span>
                    <span className="ml-auto rounded-stamp border border-line bg-amber-wash px-2 py-0.5 text-xs font-medium text-amber">{p.status}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label="Documentos" className="border-t-2 border-brand pt-4">
            <h2 className="font-display text-xl font-semibold">Documentos</h2>
            {d.documentos.length === 0 && <p className="mt-2 text-muted">Nenhum documento anexado.</p>}
            {d.documentos.length > 0 && (
              <ul className="mt-2 divide-y divide-line border-b border-line">
                {d.documentos.map((x) => (
                  <li key={x.id} className="border-t border-line py-2.5 text-[15px] first:border-t-0">
                    {x.titulo}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
