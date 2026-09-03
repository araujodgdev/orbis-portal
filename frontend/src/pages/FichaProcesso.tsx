// frontend/src/pages/FichaProcesso.tsx
import { useEffect, useState, type CSSProperties } from 'react';
import { api } from '../lib/api';

type Ficha = {
  data: { numero_cnj: string };
  movimentacoes: Array<{ id: string; data: string; texto: string }>;
  prazos: Array<{ id: string; data: string; tipo: string; status: string }>;
  documentos: Array<{ id: string; titulo: string }>;
};

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

const h2Style: CSSProperties = { fontFamily: serif, fontSize: 19, margin: '0 0 8px', color: ink };
const listStyle: CSSProperties = { margin: 0, paddingLeft: 18, fontFamily: sans, fontSize: 15, lineHeight: 1.7, color: ink };

// Timeline rail: the one distinctive element — movimentações are a true
// chronological sequence, so a vertical rail with dots is the honest device.
const timelineStyle: CSSProperties = {
  margin: 0,
  padding: 0,
  listStyle: 'none',
  fontFamily: sans,
  fontSize: 15,
  lineHeight: 1.6,
  color: ink,
};

const timelineItemStyle: CSSProperties = {
  position: 'relative',
  padding: '0 0 14px 22px',
  borderLeft: `2px solid ${line}`,
  marginLeft: 6,
};

const timelineDotStyle: CSSProperties = {
  position: 'absolute',
  left: -7,
  top: 5,
  width: 12,
  height: 12,
  borderRadius: '50%',
  background: brand,
  border: '2px solid #fff',
  boxShadow: `0 0 0 1px ${line}`,
};

export function FichaProcesso({ id }: { id: string }) {
  const [d, setD] = useState<null | Ficha>(null);
  const [error, setError] = useState('');
  useEffect(() => { api(`/api/processos/${id}`).then(setD as never).catch((e) => setError(String(e))); }, [id]);
  if (error) return (
    <main style={{ padding: 16, fontFamily: sans, color: ink }}>
      <p>Erro ao carregar ficha: {error}</p>
      <p><a href="/processos" style={{ color: brand }}>Voltar para processos</a></p>
    </main>
  );
  if (!d) return <p style={{ fontFamily: sans, color: ink }}>Carregando ficha…</p>;
  return (
    <main style={{ padding: '20px 16px 96px', maxWidth: 680, margin: '0 auto', background: paper, minHeight: '100vh', fontFamily: sans }}>
      <h1 style={{ fontFamily: serif, fontSize: 24, margin: '4px 0 12px', color: brand }}>{d.data.numero_cnj}</h1>
      <button
        title="Disponível com Hermes — sub-projeto 3"
        style={{ padding: '10px 16px', minHeight: 40, borderRadius: 8, border: `1px solid ${brand}`, background: brand, color: '#fff', fontSize: 15, fontWeight: 600, cursor: 'pointer', marginBottom: 16 }}
        onClick={() => api('/api/jobs', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tipo: 'minuta', payload: { processo_id: id } }) }).then(() => alert('Pedido enfileirado (Hermes plugado no sub-projeto 3).'))}
      >Pedir minuta</button>
      <section style={{ background: cardBg, border: `1px solid ${line}`, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
        <h2 style={h2Style}>Movimentações</h2>
        {d.movimentacoes.length === 0 && <p style={{ margin: 0, color: muted }}>Nenhuma movimentação registrada.</p>}
        <ul style={timelineStyle}>{d.movimentacoes.map((m) => (
          <li key={m.id} style={timelineItemStyle}>
            <span style={timelineDotStyle} aria-hidden="true" />
            <span style={{ color: muted, fontSize: 13 }}>{m.data}</span><br />{m.texto}
          </li>))}</ul>
      </section>
      <section style={{ background: cardBg, border: `1px solid ${line}`, borderLeft: `4px solid ${amber}`, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
        <h2 style={h2Style}>Prazos</h2>
        {d.prazos.length === 0 && <p style={{ margin: 0, color: muted }}>Nenhum prazo em aberto.</p>}
        <ul style={listStyle}>{d.prazos.map((p) => <li key={p.id}>{p.data} · {p.tipo} · {p.status}</li>)}</ul>
      </section>
      <section style={{ background: cardBg, border: `1px solid ${line}`, borderLeft: `4px solid ${seal}`, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
        <h2 style={h2Style}>Documentos</h2>
        {d.documentos.length === 0 && <p style={{ margin: 0, color: muted }}>Nenhum documento anexado.</p>}
        <ul style={listStyle}>{d.documentos.map((x) => <li key={x.id}>{x.titulo}</li>)}</ul>
      </section>
    </main>
  );
}
