// frontend/src/pages/Clientes.tsx
import { useEffect, useState, type CSSProperties } from 'react';
import { api } from '../lib/api';

type Cliente = { id: string; nome: string; contato?: string; honorario_status?: string };

const ink = '#1c2430';
const muted = '#5d6874';
const paper = '#f6f4ee';
const cardBg = '#ffffff';
const line = '#e2dccc';
const brand = '#1e3a5f';
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const serif = "Georgia, 'Times New Roman', serif";

const cardStyle: CSSProperties = {
  background: cardBg,
  border: `1px solid ${line}`,
  borderLeft: `4px solid ${brand}`,
  borderRadius: 10,
  padding: '12px 14px',
  marginBottom: 12,
};

export function Clientes() {
  const [data, setData] = useState<Cliente[] | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<{ data: Cliente[] }>('/api/clientes')
      .then((r) => setData(r.data))
      .catch((e) => setError(String(e)));
  }, []);
  if (error) return <main style={{ padding: 16, fontFamily: sans, color: ink }}><p>Erro ao carregar: {error}</p></main>;
  if (!data) return <main style={{ padding: 16, fontFamily: sans, color: ink }}><p>Carregando…</p></main>;
  return (
    <main style={{ padding: '20px 16px 96px', maxWidth: 640, margin: '0 auto', background: paper, minHeight: '100vh', fontFamily: sans }}>
      <h1 style={{ fontFamily: serif, fontSize: 26, margin: '4px 0 4px', color: brand }}>Clientes ({data.length})</h1>
      <p style={{ margin: '0 0 16px', color: muted, fontSize: 14 }}>Quem o escritório atende.</p>
      {data.length === 0 && <p style={{ color: muted }}>Nenhum cliente cadastrado ainda.</p>}
      {data.map((c) => (
        <article key={c.id} style={cardStyle}>
          <h2 style={{ fontFamily: serif, fontSize: 17, margin: '0 0 4px', color: ink }}>{c.nome}</h2>
          {!!c.contato && <p style={{ margin: 0, fontSize: 14 }}>{c.contato}</p>}
          {!!c.honorario_status && <p style={{ margin: '4px 0 0', fontSize: 13, color: muted }}>{c.honorario_status}</p>}
        </article>
      ))}
    </main>
  );
}
