// frontend/src/pages/Cadastro.tsx
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { Logo } from '../components/Logo';

const fieldClass =
  'h-11 w-full rounded-sheet border border-line bg-sheet px-3 text-[15px] text-ink placeholder:text-muted focus:border-brand focus:outline-none';

function statusOf(e: unknown): number {
  const m = /API (\d+)/.exec(String(e));
  return m ? Number(m[1]) : 0;
}

export function Cadastro() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (pass.length < 8) {
      setError('A senha precisa de pelo menos 8 caracteres.');
      return;
    }
    setBusy(true);
    try {
      await api('/api/signup', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), pass }),
      });
      window.location.href = '/boas-vindas';
    } catch (err) {
      setError(
        statusOf(err) === 409
          ? 'Este e-mail já tem conta. Entre com sua senha.'
          : 'Não foi possível criar a conta. Confira os dados.',
      );
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 font-sans">
      <main className="w-full max-w-sm rounded-panel border border-line bg-sheet p-6 shadow-sheet sm:p-8">
        <Logo />
        <p className="mt-2 text-sm text-muted">Portal do escritório</p>
        <h1 className="mt-6 font-display text-xl font-semibold text-ink">Criar conta</h1>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="signup-email" className="mb-1 block text-sm text-muted">E-mail profissional</label>
            <input
              id="signup-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={fieldClass}
              placeholder="voce@escritorio.com.br"
            />
          </div>
          <div>
            <label htmlFor="signup-pass" className="mb-1 block text-sm text-muted">Senha</label>
            <input
              id="signup-pass"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className={fieldClass}
              placeholder="Mínimo de 8 caracteres"
            />
          </div>
          {error && (
            <p role="alert" className="rounded-stamp border border-seal/30 bg-seal-wash px-3 py-2 text-sm text-seal-deep">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="min-h-11 w-full rounded-stamp bg-brand px-4 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep disabled:opacity-60"
          >
            {busy ? 'Criando…' : 'Criar conta'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-muted">
          Já tem conta? <a href="/login" className="font-semibold text-brand">Entrar</a>
        </p>
      </main>
    </div>
  );
}
