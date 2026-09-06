// frontend/src/pages/ClienteNovo.tsx
import { useState } from 'react';
import { api } from '../lib/api';
import { ClienteForm, EMPTY_CLIENTE, type ClienteFormValues } from '../components/ClienteForm';

export function ClienteNovo() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(v: ClienteFormValues) {
    setError('');
    setBusy(true);
    try {
      const r = await api<{ data: { id: string } }>('/api/clientes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(v),
      });
      window.location.href = `/clientes/${encodeURIComponent(r.data.id)}`;
    } catch {
      setError('Não foi possível cadastrar. Confira os dados.');
      setBusy(false);
    }
  }

  return (
    <main className="font-sans text-ink">
      <a href="/clientes" className="text-sm text-brand underline-offset-2 hover:text-brand-deep hover:underline">
        Voltar para clientes
      </a>
      <h1 className="mt-2 font-display text-2xl font-semibold text-brand sm:text-3xl">Novo cliente</h1>
      <ClienteForm initial={EMPTY_CLIENTE} submitLabel="Cadastrar cliente" busy={busy} error={error} onSubmit={onSubmit} />
    </main>
  );
}
