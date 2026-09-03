// frontend/src/pages/Login.tsx
import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';

const fieldClass =
  'h-11 w-full rounded-sheet border border-line bg-sheet px-3 text-[15px] text-ink placeholder:text-muted focus:border-brand focus:outline-none';

export function Login() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await api('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), pass }),
      });
      window.location.href = '/';
    } catch {
      setError('Não foi possível entrar. Confira o e-mail e a senha.');
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 font-sans">
      <main className="w-full max-w-sm rounded-panel border border-line bg-sheet p-6 shadow-sheet sm:p-8">
        <p className="font-display text-3xl leading-none font-semibold text-brand">Orbis</p>
        <p className="mt-2 text-sm text-muted">Portal do escritório</p>
        <h1 className="mt-6 font-display text-xl font-semibold text-ink">Entrar</h1>
        <form onSubmit={onSubmit} className="mt-4 space-y-3">
          <div>
            <label htmlFor="login-email" className="mb-1 block text-sm text-muted">E-mail</label>
            <input
              id="login-email"
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
            <label htmlFor="login-pass" className="mb-1 block text-sm text-muted">Senha</label>
            <input
              id="login-pass"
              type="password"
              autoComplete="current-password"
              required
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              className={fieldClass}
              placeholder="••••••••"
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
            {busy ? 'Entrando…' : 'Entrar'}
          </button>
        </form>
      </main>
    </div>
  );
}
