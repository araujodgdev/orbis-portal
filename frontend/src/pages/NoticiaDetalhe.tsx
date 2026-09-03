// frontend/src/pages/NoticiaDetalhe.tsx
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Noticia = {
  id: string;
  titulo: string;
  link: string;
  resumo?: string;
  area: string;
  fonte?: string;
  publicado_em?: string;
};

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function readingTime(resumo?: string): string {
  if (!resumo) return '—';
  return `~${Math.max(1, Math.round(resumo.length / 900))} min de leitura`;
}

export function NoticiaDetalhe({ id }: { id: string }) {
  const [n, setN] = useState<Noticia | null>(null);
  const [related, setRelated] = useState<Noticia[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setN(null);
    setRelated([]);
    setError('');
    api<{ data: Noticia }>(`/api/noticias/${encodeURIComponent(id)}`)
      .then((r) => {
        setN(r.data);
        return api<{ data: Noticia[] }>(`/api/noticias?area=${encodeURIComponent(r.data.area)}`);
      })
      .then((r) => setRelated(r.data.filter((x) => x.id !== id).slice(0, 3)))
      .catch((e) => setError(String(e)));
  }, [id]);

  if (error) return (
    <main className="font-sans text-ink">
      <p>Erro ao carregar notícia: {error}</p>
      <p className="mt-2"><a href="/noticias" className="text-brand underline underline-offset-2 hover:text-brand-deep">Voltar para notícias</a></p>
    </main>
  );
  if (!n) return <p className="font-sans text-ink">Carregando notícia…</p>;

  return (
    <main className="font-sans text-ink">
      <a href="/noticias" className="text-sm text-brand underline-offset-2 hover:text-brand-deep hover:underline">
        Voltar para notícias
      </a>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="inline-flex items-center rounded-stamp bg-brand-wash px-2 py-0.5 text-[13px] font-medium text-brand">
          {n.area}
        </span>
        {n.fonte && <span className="text-[13px] text-muted">{n.fonte}</span>}
        <span className="text-[13px] text-muted">{formatDate(n.publicado_em)}</span>
      </div>

      <h1 className="mt-3 max-w-3xl font-display text-2xl leading-snug font-semibold text-balance sm:text-3xl">
        {n.titulo}
      </h1>

      {!!n.resumo && (
        <p className="mt-4 max-w-3xl text-[16px] leading-relaxed text-ink/90">{n.resumo}</p>
      )}

      <section aria-label="Ficha da notícia" className="mt-6 max-w-3xl rounded-sheet border border-line bg-sheet p-4 shadow-sheet sm:p-5">
        <h2 className="font-display text-lg font-semibold">Ficha</h2>
        <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2.5 text-[15px] sm:grid-cols-2">
          <div className="flex justify-between gap-4 border-b border-line pb-2">
            <dt className="text-muted">Área</dt>
            <dd className="font-medium">{n.area}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-line pb-2">
            <dt className="text-muted">Fonte</dt>
            <dd className="font-medium">{n.fonte || '—'}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-line pb-2">
            <dt className="text-muted">Publicado em</dt>
            <dd className="font-medium">{formatDate(n.publicado_em)}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-line pb-2">
            <dt className="text-muted">Leitura</dt>
            <dd className="font-medium">{readingTime(n.resumo)}</dd>
          </div>
        </dl>
        <a
          href={n.link}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex min-h-11 cursor-pointer items-center justify-center rounded-sheet border border-brand bg-brand px-5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep"
        >
          Ler notícia original ↗
        </a>
      </section>

      {related.length > 0 && (
        <section aria-label="Notícias relacionadas" className="mt-6 max-w-3xl">
          <h2 className="font-display text-lg font-semibold">Relacionadas · {n.area}</h2>
          <ul className="mt-3 divide-y divide-line rounded-sheet border border-line bg-sheet shadow-sheet">
            {related.map((r) => (
              <li key={r.id}>
                <a
                  href={`/noticias/${encodeURIComponent(r.id)}`}
                  className="block cursor-pointer px-4 py-3 transition-colors hover:bg-paper"
                >
                  <p className="font-medium text-ink">{r.titulo}</p>
                  {r.fonte && <p className="mt-0.5 text-[13px] text-muted">{r.fonte}</p>}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
