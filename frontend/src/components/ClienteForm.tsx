// frontend/src/components/ClienteForm.tsx
import { useState, type FormEvent } from 'react';

export type ClienteFormValues = {
  tipo: string;
  nome: string;
  cpf_cnpj: string;
  doc_extra: string;
  email: string;
  telefone: string;
  endereco: string;
  contato: string;
  observacoes: string;
  honorario_status: string;
  honorario_valor: number;
  honorario_vencimento: string;
  honorario_forma: string;
};

export const EMPTY_CLIENTE: ClienteFormValues = {
  tipo: 'pf', nome: '', cpf_cnpj: '', doc_extra: '', email: '', telefone: '',
  endereco: '', contato: '', observacoes: '', honorario_status: 'em dia',
  honorario_valor: 0, honorario_vencimento: '', honorario_forma: 'mensal',
};

export function centsToBRL(cents: number): string {
  return (cents / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseBRL(raw: string): number {
  const n = Number(raw.replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : NaN;
}

const fieldClass =
  'h-11 w-full rounded-sheet border border-line bg-sheet px-3 text-[15px] text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none';

function Label({ htmlFor, children }: { htmlFor: string; children: string }) {
  return <label htmlFor={htmlFor} className="mb-1 block text-sm text-muted">{children}</label>;
}

export function ClienteForm({
  initial, submitLabel, busy, error, onSubmit,
}: {
  initial: ClienteFormValues;
  submitLabel: string;
  busy: boolean;
  error: string;
  onSubmit: (v: ClienteFormValues) => void;
}) {
  const [v, setV] = useState(initial);
  const [valorTxt, setValorTxt] = useState(
    initial.honorario_valor > 0 ? (initial.honorario_valor / 100).toFixed(2).replace('.', ',') : '',
  );
  const [localError, setLocalError] = useState('');

  function set<K extends keyof ClienteFormValues>(k: K, val: ClienteFormValues[K]) {
    setV((prev) => ({ ...prev, [k]: val }));
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError('');
    const cents = valorTxt.trim() === '' ? 0 : parseBRL(valorTxt);
    if (!Number.isInteger(cents)) {
      setLocalError('Valor dos honorários inválido. Use formato 1500,00.');
      return;
    }
    onSubmit({ ...v, nome: v.nome.trim(), honorario_valor: cents });
  }

  const shown = error || localError;

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-5">
      <fieldset>
        <legend className="font-display text-lg font-semibold text-ink">Identificação</legend>
        <div className="mt-2 flex gap-2">
          {(['pf', 'pj'] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={v.tipo === t}
              onClick={() => set('tipo', t)}
              className={v.tipo === t
                ? 'rounded-stamp bg-brand px-4 py-1.5 text-sm font-semibold text-white'
                : 'rounded-stamp border border-line bg-sheet px-4 py-1.5 text-sm text-ink hover:border-brand'}
            >
              {t === 'pf' ? 'Pessoa física' : 'Pessoa jurídica'}
            </button>
          ))}
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="cli-nome">{v.tipo === 'pf' ? 'Nome completo' : 'Razão social'}</Label>
            <input id="cli-nome" required minLength={2} value={v.nome} onChange={(e) => set('nome', e.target.value)} className={fieldClass} />
          </div>
          <div>
            <Label htmlFor="cli-doc">{v.tipo === 'pf' ? 'CPF' : 'CNPJ'}</Label>
            <input id="cli-doc" value={v.cpf_cnpj} onChange={(e) => set('cpf_cnpj', e.target.value)} className={fieldClass} placeholder={v.tipo === 'pf' ? '000.000.000-00' : '00.000.000/0001-00'} />
          </div>
          <div>
            <Label htmlFor="cli-doc-extra">{v.tipo === 'pf' ? 'RG / OAB' : 'IE'}</Label>
            <input id="cli-doc-extra" value={v.doc_extra} onChange={(e) => set('doc_extra', e.target.value)} className={fieldClass} />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-display text-lg font-semibold text-ink">Contato e endereço</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="cli-email">E-mail</Label>
            <input id="cli-email" type="email" value={v.email} onChange={(e) => set('email', e.target.value)} className={fieldClass} />
          </div>
          <div>
            <Label htmlFor="cli-tel">Telefone</Label>
            <input id="cli-tel" value={v.telefone} onChange={(e) => set('telefone', e.target.value)} className={fieldClass} placeholder="(11) 99999-0000" />
          </div>
          <div>
            <Label htmlFor="cli-contato">Outro contato</Label>
            <input id="cli-contato" value={v.contato} onChange={(e) => set('contato', e.target.value)} className={fieldClass} />
          </div>
          <div>
            <Label htmlFor="cli-end">Endereço</Label>
            <input id="cli-end" value={v.endereco} onChange={(e) => set('endereco', e.target.value)} className={fieldClass} />
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="font-display text-lg font-semibold text-ink">Honorários</legend>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="cli-hstatus">Status</Label>
            <select id="cli-hstatus" value={v.honorario_status} onChange={(e) => set('honorario_status', e.target.value)} className={fieldClass}>
              <option value="em dia">Em dia</option>
              <option value="atrasado">Atrasado</option>
              <option value="suspenso">Suspenso</option>
              <option value="quitado">Quitado</option>
            </select>
          </div>
          <div>
            <Label htmlFor="cli-hforma">Cobrança</Label>
            <select id="cli-hforma" value={v.honorario_forma} onChange={(e) => set('honorario_forma', e.target.value)} className={fieldClass}>
              <option value="mensal">Mensal</option>
              <option value="exito">Êxito</option>
              <option value="fixo">Fixo</option>
            </select>
          </div>
          <div>
            <Label htmlFor="cli-hvalor">Valor (R$)</Label>
            <input id="cli-hvalor" inputMode="decimal" value={valorTxt} onChange={(e) => setValorTxt(e.target.value)} className={fieldClass} placeholder="1500,00" />
          </div>
          <div>
            <Label htmlFor="cli-hvenc">Vencimento (dia)</Label>
            <input id="cli-hvenc" inputMode="numeric" value={v.honorario_vencimento} onChange={(e) => set('honorario_vencimento', e.target.value)} className={fieldClass} placeholder="10" />
          </div>
        </div>
      </fieldset>

      <div>
        <Label htmlFor="cli-obs">Observações</Label>
        <textarea id="cli-obs" rows={3} value={v.observacoes} onChange={(e) => set('observacoes', e.target.value)} className={`${fieldClass} h-auto py-2.5`} />
      </div>

      {shown && (
        <p role="alert" className="rounded-stamp border border-seal/30 bg-seal-wash px-3 py-2 text-sm text-seal-deep">
          {shown}
        </p>
      )}
      <button
        type="submit"
        disabled={busy}
        className="min-h-11 w-full rounded-stamp bg-brand px-4 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60 sm:w-auto"
      >
        {busy ? 'Salvando…' : submitLabel}
      </button>
    </form>
  );
}
