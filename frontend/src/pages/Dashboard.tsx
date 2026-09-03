// frontend/src/pages/Dashboard.tsx
import { useEffect, useState, type CSSProperties } from 'react';
import { api } from '../lib/api';

export function riskLabel(p: { status: string }): string {
  if (p.status === 'perdido') return 'Perdido';
  if (p.status === 'aberto') return 'Urgente';
  return 'Aberto';
}

type Dash = { prazos7d: Array<{ id: string; data: string; tipo: string; numero_cnj?: string }>; naoLidas: Array<{ id: string; texto: string; data: string }>; risco: Array<{ id: string; numero_cnj: string }> };

const ink = '#1c2430';
const muted = '#5d6874';
const paper = '#f6f4ee';
const cardBg = '#ffffff';
const line = '#e2dccc';
const brand = '#1e3a5f';
const amber = '#8a5a00';
const seal = '#a61e1e';
const sans = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
const serif = "Georgia, 'Times New Roman', serif";

function card(spine: string): CSSProperties {
  return {
    background: cardBg,
    border: `1px solid ${line}`,
    borderLeft: `4px solid ${spine}`,
    borderRadius: 10,
    padding: '12px 14px',
    marginBottom: 12,
  };
}

const listStyle: CSSProperties ={ margin: 0, paddingLeft: 18, fontFamily: sans, fontSize: 15, lineHeight: 1.7, color: ink };
const h2Style: CSSProperties ={ fontFamily: serif, fontSize: 19, margin: '0 0 8px', color: ink };

export function Dashboard() {
  const [data, setData] = useState<Dash | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api<{ prazos7d: Dash['prazos7d']; naoLidas: Dash['naoLidas']; risco: Dash['risco'] }>('/api/dashboard')
      .then((d) => setData(d as Dash)).catch((e) => setError(String(e)));
  }, []);
  if (error) return <main style={{ padding: 16, fontFamily: sans, color: ink }}><p>Erro ao carregar: {error}</p></main>;
  if (!data) return <main style={{ padding: 16, fontFamily: sans, color: ink }}><p>Carregando…</p></main>;
  return (
    <main style={{ padding: '20px 16px 96px', maxWidth: 640, margin: '0 auto', background: paper, minHeight: '100vh', fontFamily: sans }}>
      <h1 style={{ fontFamily: serif, fontSize: 26, margin: '4px 0 4px', color: brand }}>Hoje no escritório</h1>
      <p style={{ margin: '0 0 16px', color: muted, fontSize: 14 }}>Prazos, movimentações e riscos num só olhar.</p>
      <section style={card(brand)}><h2 style={h2Style}>Prazos 7 dias ({data.prazos7d.length})</h2>
        {data.prazos7d.length === 0 && <p style={{ margin: 0, color: muted }}>Nenhum prazo próximo. 🎉</p>}
        <ul style={listStyle}>{data.prazos7d.map((p) => <li key={p.id}>{p.data} · {p.tipo} · {p.numero_cnj ?? ''}</li>)}</ul>
      </section>
      <section style={card(amber)}><h2 style={h2Style}>Não lidas ({data.naoLidas.length})</h2>
        <ul style={listStyle}>{data.naoLidas.map((m) => (
          <li key={m.id}>{m.data} — {m.texto.slice(0, 80)}
            <button
              style={{ marginLeft: 8, padding: '8px 12px', minHeight: 36, borderRadius: 8, border: `1px solid ${brand}`, background: brand, color: '#fff', fontSize: 14 }}
              onClick={() => api(`/api/movimentacoes/${m.id}/lida`, { method: 'PATCH' }).then(() => location.reload())}>Marcar lida</button>
          </li>))}</ul>
      </section>
      <section style={card(seal)}><h2 style={h2Style}>Risco ({data.risco.length})</h2>
        <ul style={listStyle}>{data.risco.map((r) => <li key={r.id}>⚠️ {r.numero_cnj}</li>)}</ul>
      </section>
    </main>
  );
}
