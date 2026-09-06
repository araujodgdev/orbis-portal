// frontend/src/pages/ProcessoEditar.tsx
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';

const fieldClass =
  'h-11 w-full rounded-sheet border border-line bg-sheet px-3 text-[15px] text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none';

type Proc = { fase: string; responsavel: string; area: string; tribunal: string; status: string };

export function ProcessoEditar({ id }: { id: string }) {
  const [form, setForm] = useState<Proc | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ data: Proc }>(`/api/processos/${encodeURIComponent(id)}`)
      .then((r) => setForm({
        fase: r.data.fase, responsavel: r.data.responsavel ?? '', area: r.data.area,
        tribunal: r.data.tribunal ?? '', status: r.data.status,
      }))
      .catch((e) => setError(String(e)));
  }, [id]);

  function set<K extends keyof Proc>(k: K, val: string) {
    setForm((prev) => (prev ? { ...prev, [k]: val } : prev));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setError('');
    setBusy(true);
    try {
      await api(`/api/processos/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(form),
      });
      window.location.href = `/processos/${encodeURIComponent(id)}`;
    } catch {
      setError('Não foi possível salvar. Confira os dados.');
      setBusy(false);
    }
  }

  if (error && !form) return <main className="font-sans text-ink"><p>Erro ao carregar: {error}</p></main>;
  if (!form) return <p className="font-sans text-ink">Carregando…</p>;

  return (
    <main className="font-sans text-ink">
      <a href={`/processos/${encodeURIComponent(id)}`} className="text-sm text-brand underline-offset-2 hover:text-brand-deep hover:underline">
        Voltar para a ficha
      </a>
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand sm:text-3xl">Editar processo</h1>
      <form onSubmit={onSubmit} className="mt-4 grid max-w-2xl gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="pe-fase" className="mb-1 block text-sm text-muted">Fase</label>
          <select id="pe-fase" value={form.fase} onChange={(e) => set('fase', e.target.value)} className={fieldClass}>
            <option value="conhecimento">Conhecimento</option>
            <option value="execucao">Execução</option>
            <option value="recursal">Recursal</option>
          </select>
        </div>
        <div>
          <label htmlFor="pe-status" className="mb-1 block text-sm text-muted">Status</label>
          <select id="pe-status" value={form.status} onChange={(e) => set('status', e.target.value)} className={fieldClass}>
            <option value="ativo">Ativo</option>
            <option value="suspenso">Suspenso</option>
            <option value="arquivado">Arquivado</option>
          </select>
        </div>
        <div>
          <label htmlFor="pe-trib" className="mb-1 block text-sm text-muted">Tribunal</label>
          <input id="pe-trib" value={form.tribunal} onChange={(e) => set('tribunal', e.target.value)} className={fieldClass} />
        </div>
        <div>
          <label htmlFor="pe-resp" className="mb-1 block text-sm text-muted">Responsável</label>
          <input id="pe-resp" value={form.responsavel} onChange={(e) => set('responsavel', e.target.value)} className={fieldClass} />
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="pe-area" className="mb-1 block text-sm text-muted">Área</label>
          <select id="pe-area" value={form.area} onChange={(e) => set('area', e.target.value)} className={fieldClass}>
            <option value="civel">Cível</option>
            <option value="trabalhista">Trabalhista</option>
            <option value="tributario">Tributário</option>
            <option value="penal">Penal</option>
            <option value="empresarial">Empresarial</option>
          </select>
        </div>
        {error && (
          <p role="alert" className="sm:col-span-2 rounded-stamp border border-seal/30 bg-seal-wash px-3 py-2 text-sm text-seal-deep">
            {error}
          </p>
        )}
        <div className="sm:col-span-2">
          <button
            type="submit" disabled={busy}
            className="min-h-11 w-full rounded-stamp bg-brand px-4 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60 sm:w-auto"
          >
            {busy ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </main>
  );
}
