// frontend/src/pages/ProcessoNovo.tsx
import { useState, type FormEvent, type KeyboardEvent, type SyntheticEvent } from 'react';
import { api } from '../lib/api';
import { FormSection, RequiredMark } from '../components/FormSection';

type ClienteOpt = { id: string; nome: string; cpf_cnpj?: string };

const fieldClass =
  'h-11 w-full rounded-sheet border border-line bg-sheet px-3 text-[15px] text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none';

export function ProcessoNovo() {
  const [numeroCnj, setNumeroCnj] = useState('');
  const [busca, setBusca] = useState('');
  const [opcoes, setOpcoes] = useState<ClienteOpt[] | null>(null);
  const [clienteId, setClienteId] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [tribunal, setTribunal] = useState('');
  const [fase, setFase] = useState('conhecimento');
  const [responsavel, setResponsavel] = useState('');
  const [area, setArea] = useState('civel');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onBuscar(e: SyntheticEvent) {
    e.preventDefault();
    setOpcoes(null);
    try {
      const r = await api<{ data: ClienteOpt[] }>(`/api/clientes?nome=${encodeURIComponent(busca.trim())}`);
      setOpcoes(r.data);
    } catch {
      setError('Não foi possível buscar clientes.');
    }
  }

  function onBuscaKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') onBuscar(e);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!clienteId) {
      setError('Escolha o cliente do processo.');
      return;
    }
    setBusy(true);
    try {
      const r = await api<{ data: { id: string } }>('/api/processos', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          cliente_id: clienteId, numero_cnj: numeroCnj.trim(), tribunal: tribunal.trim(),
          fase, responsavel: responsavel.trim(), area,
        }),
      });
      window.location.href = `/processos/${encodeURIComponent(r.data.id)}`;
    } catch {
      setError('Não foi possível cadastrar. Confira o CNJ e os dados.');
      setBusy(false);
    }
  }

  return (
    <main className="font-sans text-ink">
      <a href="/processos" className="text-sm text-brand underline-offset-2 hover:text-brand-deep hover:underline">
        Voltar para processos
      </a>
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand sm:text-3xl">Novo processo</h1>
      <p className="mt-1 text-sm text-muted">Vincule um cliente e o número CNJ para começar a acompanhar prazos e movimentações.</p>
      <form onSubmit={onSubmit} className="mt-4 max-w-2xl space-y-4">
        <div>
          <label htmlFor="pro-cnj" className="mb-1 block text-sm text-muted">
            Número CNJ<RequiredMark />
          </label>
          <input
            id="pro-cnj" required value={numeroCnj} onChange={(e) => setNumeroCnj(e.target.value)}
            className={`${fieldClass} font-mono tracking-tight`} placeholder="0000000-00.0000.0.00.0000"
          />
          <p className="mt-1 text-xs text-muted">Formato: 0000000-00.0000.0.00.0000</p>
        </div>

        <FormSection title="Cliente do processo" hint="Busque um cliente já cadastrado para vincular ao processo.">
          {clienteId ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-[15px] font-medium">{clienteNome}</p>
              <button
                type="button"
                onClick={() => { setClienteId(''); setClienteNome(''); setOpcoes(null); }}
                className="text-sm font-semibold text-brand hover:text-brand-deep"
              >Trocar</button>
            </div>
          ) : (
            <>
              <div className="flex gap-2">
                <input
                  value={busca} onChange={(e) => setBusca(e.target.value)} onKeyDown={onBuscaKeyDown}
                  className={fieldClass} placeholder="Buscar por nome" aria-label="Buscar cliente por nome"
                />
                <button
                  type="button" onClick={onBuscar}
                  className="h-11 shrink-0 rounded-sheet border border-line bg-paper px-4 text-[15px] font-medium transition-colors hover:border-brand/40"
                >Buscar</button>
              </div>
              <div aria-live="polite">
                {opcoes !== null && opcoes.length === 0 && (
                  <p className="mt-2 text-sm text-muted">Nenhum cliente encontrado. <a href="/clientes/novo" className="font-semibold text-brand">Cadastrar cliente</a></p>
                )}
                {opcoes !== null && opcoes.length > 0 && (
                  <ul className="mt-2 divide-y divide-line rounded-sheet border border-line">
                    {opcoes.map((o) => (
                      <li key={o.id}>
                        <button
                          type="button"
                          onClick={() => { setClienteId(o.id); setClienteNome(o.nome); }}
                          className="flex w-full cursor-pointer flex-wrap items-center gap-x-2 px-3 py-2 text-left text-[15px] hover:bg-paper"
                        >
                          <span className="font-medium">{o.nome}</span>
                          {!!o.cpf_cnpj && <span className="text-sm text-muted">{o.cpf_cnpj}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </FormSection>

        <FormSection title="Dados do processo">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="pro-trib" className="mb-1 block text-sm text-muted">Tribunal</label>
              <input id="pro-trib" value={tribunal} onChange={(e) => setTribunal(e.target.value)} className={fieldClass} placeholder="TJSP" />
            </div>
            <div>
              <label htmlFor="pro-resp" className="mb-1 block text-sm text-muted">Responsável</label>
              <input id="pro-resp" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="pro-fase" className="mb-1 block text-sm text-muted">Fase</label>
              <select id="pro-fase" value={fase} onChange={(e) => setFase(e.target.value)} className={fieldClass}>
                <option value="conhecimento">Conhecimento</option>
                <option value="execucao">Execução</option>
                <option value="recursal">Recursal</option>
              </select>
            </div>
            <div>
              <label htmlFor="pro-area" className="mb-1 block text-sm text-muted">Área</label>
              <select id="pro-area" value={area} onChange={(e) => setArea(e.target.value)} className={fieldClass}>
                <option value="civel">Cível</option>
                <option value="trabalhista">Trabalhista</option>
                <option value="tributario">Tributário</option>
                <option value="penal">Penal</option>
                <option value="empresarial">Empresarial</option>
              </select>
            </div>
          </div>
        </FormSection>

        {error && (
          <p role="alert" className="rounded-stamp border border-seal/30 bg-seal-wash px-3 py-2 text-sm text-seal-deep">
            {error}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit" disabled={busy}
            className="min-h-11 w-full rounded-stamp bg-brand px-4 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {busy ? 'Cadastrando…' : 'Cadastrar processo'}
          </button>
          <a href="/processos" className="text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline">
            Cancelar
          </a>
        </div>
      </form>
    </main>
  );
}
