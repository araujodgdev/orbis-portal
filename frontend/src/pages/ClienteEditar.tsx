// frontend/src/pages/ClienteEditar.tsx
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { ClienteForm, EMPTY_CLIENTE, type ClienteFormValues } from '../components/ClienteForm';

export function ClienteEditar({ id }: { id: string }) {
  const [initial, setInitial] = useState<ClienteFormValues | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ data: Record<string, unknown }>(`/api/clientes/${encodeURIComponent(id)}`)
      .then((r) => setInitial({ ...EMPTY_CLIENTE, ...(r.data as Partial<ClienteFormValues>) }))
      .catch((e) => setError(String(e)));
  }, [id]);

  async function onSubmit(v: ClienteFormValues) {
    setError('');
    setBusy(true);
    try {
      await api(`/api/clientes/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(v),
      });
      window.location.href = `/clientes/${encodeURIComponent(id)}`;
    } catch {
      setError('Não foi possível salvar. Confira os dados.');
      setBusy(false);
    }
  }

  if (error && !initial) return <main className="font-sans text-ink"><p>Erro ao carregar: {error}</p></main>;
  if (!initial) return <p className="font-sans text-ink">Carregando…</p>;

  return (
    <main className="font-sans text-ink">
      <a href={`/clientes/${encodeURIComponent(id)}`} className="text-sm text-brand underline-offset-2 hover:text-brand-deep hover:underline">
        Voltar para a ficha
      </a>
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand sm:text-3xl">Editar cliente</h1>
      <ClienteForm initial={initial} submitLabel="Salvar alterações" busy={busy} error={error} onSubmit={onSubmit} />
    </main>
  );
}
