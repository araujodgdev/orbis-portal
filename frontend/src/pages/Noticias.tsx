// frontend/src/pages/Noticias.tsx
import { useEffect, useState, type CSSProperties } from 'react';
import { api } from '../lib/api';

type Noticia = { id: string; titulo: string; link: string; resumo?: string; area: string; fonte?: string };

const ink = '#1c2430';
const muted = '#5d6874';
const paper = '#f6f4ee';
const cardBg = '#ffffff';
const line = '#e2dccc';
const brand = '#1e3a5f';
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const serif = "Georgia, 'Times New Roman', serif";

const selectStyle: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', minHeight: 44,
  borderRadius: 8, border: `1px solid ${line}`, fontFamily: sans, fontSize: 15, color: ink, background: cardBg,
};

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
    <main style={{ padding: '20px 16px 96px', maxWidth: 640, margin: '0 auto', background: paper, minHeight: '100vh', fontFamily: sans }}>
      <h1 style={{ fontFamily: serif, fontSize: 26, margin: '4px 0 4px', color: brand }}>Notícias</h1>
      <p style={{ margin: '0 0 16px', color: muted, fontSize: 14 }}>Curadoria jurídica do escritório.</p>
      <div style={{ marginBottom: 16 }}>
        <select style={selectStyle} value={area} onChange={(e) => setArea(e.target.value)} aria-label="Filtrar por área">
          <option value="">Todas as áreas</option>
          {AREAS.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>
      {error && <p>Erro ao carregar: {error}</p>}
      {!error && data === null && <p>Carregando…</p>}
      {!error && data !== null && data.length === 0 && <p style={{ color: muted }}>Nenhuma notícia nesta área ainda.</p>}
      {!error && data !== null && data.map((n) => (
        <article key={n.id} style={{ background: cardBg, border: `1px solid ${line}`, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
          <h2 style={{ fontFamily: serif, fontSize: 17, margin: '0 0 4px' }}>
            <a href={n.link} target="_blank" rel="noreferrer" style={{ color: brand }}>{n.titulo}</a>
          </h2>
          <p style={{ margin: '0 0 4px', fontSize: 13, color: muted }}>{n.area}{n.fonte ? ` · ${n.fonte}` : ''}</p>
          {!!n.resumo && <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>{n.resumo}</p>}
        </article>
      ))}
    </main>
  );
}
