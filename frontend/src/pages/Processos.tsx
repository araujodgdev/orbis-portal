// frontend/src/pages/Processos.tsx
import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { api } from '../lib/api';

type Processo = { id: string; numero_cnj: string; cliente_nome?: string; status: string; fase: string; tribunal?: string };

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

function spine(status: string): string {
  if (status === 'perdido') return seal;
  if (status === 'arquivado') return muted;
  if (status === 'ativo') return brand;
  return amber;
}

const inputStyle: CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '10px 12px', minHeight: 44,
  borderRadius: 8, border: `1px solid ${line}`, fontFamily: sans, fontSize: 15, color: ink, background: cardBg,
};

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
    <main style={{ padding: '20px 16px 96px', maxWidth: 640, margin: '0 auto', background: paper, minHeight: '100vh', fontFamily: sans }}>
      <h1 style={{ fontFamily: serif, fontSize: 26, margin: '4px 0 4px', color: brand }}>Processos</h1>
      <p style={{ margin: '0 0 16px', color: muted, fontSize: 14 }}>Busque por CNJ ou nome do cliente.</p>
      <form onSubmit={onSearch} style={{ marginBottom: 16 }}>
        <input
          style={{ ...inputStyle, marginBottom: 8 }}
          placeholder="CNJ ou nome do cliente"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Buscar por CNJ ou nome"
        />
        <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
          <select style={{ ...inputStyle, flex: 1 }} value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filtrar por status">
            <option value="">Todos os status</option>
            <option value="ativo">Ativo</option>
            <option value="suspenso">Suspenso</option>
            <option value="arquivado">Arquivado</option>
          </select>
          <select style={{ ...inputStyle, flex: 1 }} value={fase} onChange={(e) => setFase(e.target.value)} aria-label="Filtrar por fase">
            <option value="">Todas as fases</option>
            <option value="conhecimento">Conhecimento</option>
            <option value="execucao">Execução</option>
            <option value="recursal">Recursal</option>
          </select>
        </div>
        <button
          type="submit"
          style={{ width: '100%', padding: '10px 16px', minHeight: 44, borderRadius: 8, border: `1px solid ${brand}`, background: brand, color: '#fff', fontSize: 15, fontWeight: 600 }}
        >Buscar</button>
      </form>
      {error && <p>Erro ao carregar: {error}</p>}
      {!error && data === null && <p>Carregando…</p>}
      {!error && data !== null && data.length === 0 && <p style={{ color: muted }}>Nenhum processo encontrado. Ajuste a busca ou os filtros.</p>}
      {!error && data !== null && data.map((p) => (
        <a key={p.id} href={`/processos/${encodeURIComponent(p.id)}`} style={{ textDecoration: 'none', color: 'inherit' }}>
          <article style={{ background: cardBg, border: `1px solid ${line}`, borderLeft: `4px solid ${spine(p.status)}`, borderRadius: 10, padding: '12px 14px', marginBottom: 12 }}>
            <h2 style={{ fontFamily: serif, fontSize: 17, margin: '0 0 4px', color: brand }}>{p.numero_cnj}</h2>
            <p style={{ margin: 0, fontSize: 15 }}>{p.cliente_nome ?? ''}</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: muted }}>{p.status} · {p.fase}{p.tribunal ? ` · ${p.tribunal}` : ''}</p>
          </article>
        </a>
      ))}
    </main>
  );
}
