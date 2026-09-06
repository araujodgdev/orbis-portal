// frontend/src/pages/ClienteFicha.tsx
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { centsToBRL } from '../components/ClienteForm';

type Ficha = {
  data: {
    nome: string; tipo?: string; cpf_cnpj?: string; doc_extra?: string; email?: string;
    telefone?: string; endereco?: string; contato?: string; observacoes?: string;
    honorario_status?: string; honorario_valor?: number; honorario_vencimento?: string;
    honorario_forma?: string;
  };
  processos: Array<{ id: string; numero_cnj: string; fase: string; status: string }>;
};

function Row({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="py-2">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="text-[15px] text-ink">{value}</dd>
    </div>
  );
}

export function ClienteFicha({ id }: { id: string }) {
  const [d, setD] = useState<Ficha | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Ficha>(`/api/clientes/${encodeURIComponent(id)}`).then(setD).catch((e) => setError(String(e)));
  }, [id]);

  async function onDelete() {
    if (!window.confirm(`Excluir ${d?.data.nome}? Só é possível sem processos vinculados.`)) return;
    try {
      await api(`/api/clientes/${encodeURIComponent(id)}`, { method: 'DELETE' });
      window.location.href = '/clientes';
    } catch (e) {
      window.alert(/API 409/.test(String(e))
        ? 'Este cliente tem processos vinculados. Arquive os processos ou transfira antes de excluir.'
        : 'Não foi possível excluir.');
    }
  }

  if (error) return <main className="font-sans text-ink"><p>Erro ao carregar ficha: {error}</p></main>;
  if (!d) return <p className="font-sans text-ink">Carregando ficha…</p>;
  const c = d.data;

  return (
    <main className="font-sans text-ink">
      <a href="/clientes" className="text-sm text-brand underline-offset-2 hover:text-brand-deep hover:underline">
        Voltar para clientes
      </a>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <h1 className="font-display text-2xl font-semibold text-brand sm:text-3xl">{c.nome}</h1>
        <span className="rounded-stamp border border-line bg-paper px-2 py-0.5 text-[13px] text-muted">
          {c.tipo === 'pj' ? 'Pessoa jurídica' : 'Pessoa física'}
        </span>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2 lg:items-start">
        <section className="rounded-sheet border border-line bg-sheet p-5 shadow-sheet">
          <h2 className="font-display text-lg font-semibold">Dados</h2>
          <dl className="mt-1 divide-y divide-line">
            <Row label={c.tipo === 'pj' ? 'CNPJ' : 'CPF'} value={c.cpf_cnpj ?? ''} />
            <Row label={c.tipo === 'pj' ? 'IE' : 'RG / OAB'} value={c.doc_extra ?? ''} />
            <Row label="E-mail" value={c.email ?? ''} />
            <Row label="Telefone" value={c.telefone ?? ''} />
            <Row label="Outro contato" value={c.contato ?? ''} />
            <Row label="Endereço" value={c.endereco ?? ''} />
            <Row label="Observações" value={c.observacoes ?? ''} />
          </dl>
        </section>

        <section className="rounded-sheet border border-line bg-sheet p-5 shadow-sheet">
          <h2 className="font-display text-lg font-semibold">Honorários</h2>
          <dl className="mt-1 divide-y divide-line">
            <Row label="Status" value={c.honorario_status ?? ''} />
            <Row label="Valor" value={typeof c.honorario_valor === 'number' ? centsToBRL(c.honorario_valor) : ''} />
            <Row label="Vencimento" value={c.honorario_vencimento ? `Dia ${c.honorario_vencimento}` : ''} />
            <Row label="Cobrança" value={c.honorario_forma === 'exito' ? 'Êxito' : (c.honorario_forma ?? '')} />
          </dl>
        </section>
      </div>

      <section className="mt-5">
        <h2 className="font-display text-lg font-semibold">Processos ({d.processos.length})</h2>
        {d.processos.length === 0 && <p className="mt-1 text-sm text-muted">Nenhum processo vinculado.</p>}
        {d.processos.length > 0 && (
          <ul className="mt-2 divide-y divide-line rounded-sheet border border-line bg-sheet">
            {d.processos.map((p) => (
              <li key={p.id}>
                <a href={`/processos/${encodeURIComponent(p.id)}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 hover:bg-paper">
                  <span className="font-medium text-brand">{p.numero_cnj}</span>
                  <span className="text-sm text-muted">{p.fase} · {p.status}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-6 flex flex-wrap gap-2">
        <a
          href={`/clientes/${encodeURIComponent(id)}/editar`}
          className="inline-flex min-h-11 items-center justify-center rounded-stamp bg-brand px-5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep"
        >Editar</a>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-stamp border border-seal/40 bg-sheet px-5 text-[15px] font-medium text-seal transition-colors hover:bg-seal-wash"
        >Excluir</button>
      </div>
    </main>
  );
}
