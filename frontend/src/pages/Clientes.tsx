// frontend/src/pages/Clientes.tsx
import { useEffect, useState } from 'react';
import { api } from '../lib/api';

type Cliente = { id: string; nome: string; contato?: string; honorario_status?: string };

function statusTone(status: string): string {
  const s = status.toLowerCase();
  if (
    s.includes('atras') ||
    s.includes('venc') ||
    s.includes('inadimpl') ||
    s.includes('pendente') ||
    s.includes('aberto')
  ) {
    return 'border-amber/30 bg-amber-wash text-amber';
  }
  if (s.includes('pago') || s.includes('em dia') || s.includes('quite') || s.includes('regular')) {
    return 'border-brand/20 bg-brand-wash text-brand';
  }
  return 'border-line bg-paper text-muted';
}

function spineTone(status?: string): string {
  if (!status) return 'border-l-brand/30';
  const s = status.toLowerCase();
  if (
    s.includes('atras') ||
    s.includes('venc') ||
    s.includes('inadimpl') ||
    s.includes('pendente') ||
    s.includes('aberto')
  ) {
    return 'border-l-amber';
  }
  return 'border-l-brand';
}

export function Clientes() {
  const [data, setData] = useState<Cliente[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<{ data: Cliente[] }>('/api/clientes')
      .then((r) => setData(r.data))
      .catch((e) => setError(String(e)));
  }, []);
  if (error) return <main className="font-sans text-ink"><p>Erro ao carregar: {error}</p></main>;
  if (!data) return <main className="font-sans text-ink"><p>Carregando…</p></main>;
  return (
    <main className="font-sans">
      <h1 className="font-display text-2xl font-semibold text-brand sm:text-3xl">Clientes ({data.length})</h1>
      <p className="mt-1 text-sm text-muted">Quem o escritório atende.</p>
      {data.length === 0 && <p className="mt-6 text-muted">Nenhum cliente cadastrado ainda.</p>}
      {data.length > 0 && (
        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
          {data.map((c) => (
            <article
              key={c.id}
              className={`rounded-sheet border border-line bg-sheet p-4 shadow-sheet transition-shadow hover:shadow-lift border-l-4 ${spineTone(c.honorario_status)}`}
            >
              <h2 className="font-display text-lg leading-snug font-semibold text-ink">{c.nome}</h2>
              {!!c.contato && <p className="mt-1 text-sm break-words text-ink/80">{c.contato}</p>}
              {!!c.honorario_status && (
                <p className="mt-3">
                  <span
                    className={`inline-block rounded-stamp border px-2 py-0.5 text-[13px] leading-relaxed ${statusTone(c.honorario_status)}`}
                  >
                    {c.honorario_status}
                  </span>
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
