// frontend/src/pages/Noticias.tsx
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Noticia = { id: string; titulo: string; link: string; resumo?: string; area: string; fonte?: string };

const AREAS = ['geral', 'civel', 'trabalhista', 'penal', 'tributario', 'empresarial'];

export function Noticias() {
  const [area, setArea] = useState('');
  const [data, setData] = useState<Noticia[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    setData(null);
    setError('');
    const qs = area ? `?area=${encodeURIComponent(area)}` : '';
    api<{ data: Noticia[] }>(`/api/noticias${qs}`)
      .then((r) => setData(r.data))
      .catch((e) => setError(String(e)));
  }, [area]);

  return (
    <main className="min-w-0">
      <header className="border-b border-line pb-5">
        <h1 className="font-display text-3xl font-semibold text-brand lg:text-4xl">Notícias</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">Curadoria jurídica do escritório.</p>
      </header>

      <div className="mt-5">
        <select
          value={area}
          onChange={(e) => setArea(e.target.value)}
          aria-label="Filtrar por área"
          className="min-h-11 w-full rounded-sheet border border-line bg-sheet px-3 py-2.5 text-[15px] text-ink shadow-sheet transition-colors hover:border-brand/40 sm:max-w-xs"
        >
          <option value="">Todas as áreas</option>
          {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {error && (
        <p className="mt-6 rounded-sheet border border-seal/30 bg-seal-wash px-4 py-3 text-[15px] leading-relaxed text-seal-deep">
          Erro ao carregar: {error}
        </p>
      )}
      {!error && data === null && <p className="mt-6 text-[15px] text-muted">Carregando…</p>}
      {!error && data !== null && data.length === 0 && (
        <p className="mt-6 rounded-sheet border border-dashed border-line bg-sheet px-4 py-10 text-center text-[15px] text-muted">
          Nenhuma notícia nesta área ainda.
        </p>
      )}

      {!error && data !== null && data.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {data.map((n) => (
            <a
              key={n.id}
              href={`/noticias/${encodeURIComponent(n.id)}`}
              className="flex cursor-pointer flex-col rounded-sheet border border-line bg-sheet p-4 shadow-sheet transition-colors hover:border-brand/40 hover:shadow-lift"
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="inline-flex items-center rounded-stamp bg-brand-wash px-2 py-0.5 text-[13px] font-medium text-brand">
                  {n.area}
                </span>
                {n.fonte && <span className="text-[13px] text-muted">{n.fonte}</span>}
              </div>
              <h2 className="mt-2.5 font-display text-[17px] leading-snug font-semibold text-ink">
                {n.titulo}
              </h2>
              {!!n.resumo && <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink/80">{n.resumo}</p>}
            </a>
          ))}
        </div>
      )}
    </main>
  );
}
