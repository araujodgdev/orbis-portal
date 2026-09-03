// frontend/src/pages/Clientes.tsx
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';

type Cliente = { id: string; nome: string; contato?: string; honorario_status?: string; cpf_cnpj?: string };

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

export function Clientes() {
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [applied, setApplied] = useState({ nome: '', cpf: '', cnpj: '' });
  const [data, setData] = useState<Cliente[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    setError('');
    const params = new URLSearchParams();
    if (applied.nome) params.set('nome', applied.nome);
    if (applied.cpf) params.set('cpf', applied.cpf);
    if (applied.cnpj) params.set('cnpj', applied.cnpj);
    const qs = params.toString();
    api<{ data: Cliente[] }>(`/api/clientes${qs ? `?${qs}` : ''}`)
      .then((r) => setData(r.data))
      .catch((e) => setError(String(e)));
  }, [applied]);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    setApplied({ nome: nome.trim(), cpf: cpf.trim(), cnpj: cnpj.trim() });
  }

  function onClear() {
    setNome('');
    setCpf('');
    setCnpj('');
    setApplied({ nome: '', cpf: '', cnpj: '' });
  }

  if (error) return <main className="font-sans text-ink"><p>Erro ao carregar: {error}</p></main>;
  return (
    <main className="font-sans">
      <h1 className="font-display text-2xl font-semibold text-brand sm:text-3xl">
        Clientes{data !== null ? ` (${data.length})` : ''}
      </h1>
      <p className="mt-1 mb-5 text-sm text-muted">Quem o escritório atende.</p>

      <form onSubmit={onSearch} className="mb-6 flex flex-col gap-2 lg:flex-row lg:items-center">
        <input
          className="h-11 w-full rounded-sheet border border-line bg-sheet px-3 text-[15px] text-ink placeholder:text-muted/70 focus:border-brand lg:flex-1"
          placeholder="Nome"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          aria-label="Filtrar por nome"
        />
        <div className="grid grid-cols-2 gap-2 lg:flex lg:shrink-0">
          <input
            className="h-11 w-full rounded-sheet border border-line bg-sheet px-3 text-[15px] text-ink placeholder:text-muted/70 focus:border-brand lg:w-44"
            placeholder="CPF"
            value={cpf}
            onChange={(e) => setCpf(e.target.value)}
            aria-label="Filtrar por CPF"
          />
          <input
            className="h-11 w-full rounded-sheet border border-line bg-sheet px-3 text-[15px] text-ink placeholder:text-muted/70 focus:border-brand lg:w-52"
            placeholder="CNPJ"
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            aria-label="Filtrar por CNPJ"
          />
        </div>
        <div className="grid grid-cols-2 gap-2 lg:flex lg:shrink-0">
          <button
            type="submit"
            className="inline-flex h-11 cursor-pointer items-center justify-center rounded-sheet border border-brand bg-brand px-5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep"
          >Buscar</button>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-11 cursor-pointer items-center justify-center rounded-sheet border border-line bg-sheet px-5 text-[15px] font-medium text-muted transition-colors hover:border-brand/40 hover:text-ink"
          >Limpar</button>
        </div>
      </form>

      {data === null && <p className="text-muted">Carregando…</p>}
      {data !== null && data.length === 0 && (
        <p className="text-muted">Nenhum cliente encontrado. Ajuste os filtros.</p>
      )}
      {data !== null && data.length > 0 && (
        <div className="overflow-x-auto rounded-panel border border-line bg-sheet shadow-sheet">
          <table className="w-full min-w-[640px] border-collapse text-left text-[15px]">
            <thead>
              <tr className="border-b border-line text-sm text-muted">
                <th scope="col" className="px-4 py-3 font-medium">Nome</th>
                <th scope="col" className="px-4 py-3 font-medium">Contato</th>
                <th scope="col" className="px-4 py-3 font-medium">CPF/CNPJ</th>
                <th scope="col" className="px-4 py-3 font-medium">Honorários</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {data.map((c) => (
                <tr key={c.id} className="transition-colors hover:bg-paper">
                  <td className="px-4 py-3 font-medium text-ink">{c.nome}</td>
                  <td className="px-4 py-3 text-ink/80">{c.contato || '—'}</td>
                  <td className="px-4 py-3 whitespace-nowrap text-ink/80">{c.cpf_cnpj || '—'}</td>
                  <td className="px-4 py-3">
                    {!!c.honorario_status && (
                      <span
                        className={`inline-block rounded-stamp border px-2 py-0.5 text-[13px] leading-relaxed whitespace-nowrap ${statusTone(c.honorario_status)}`}
                      >
                        {c.honorario_status}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
