// frontend/src/pages/Onboarding.tsx
import { useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';
import { Logo } from '../components/Logo';

const AREAS = ['Cível', 'Trabalhista', 'Tributário', 'Penal', 'Empresarial', 'Família e Sucessões', 'Previdenciário', 'Administrativo'];
const TAMANHOS = ['Só eu', '2–5', '6–20', 'Mais de 20'];

const TOUR = [
  { titulo: 'Processos', texto: 'Cadastre o primeiro processo pelo número CNJ e acompanhe a ficha completa.' },
  { titulo: 'Prazos', texto: 'Lance os prazos de cada processo e veja o que vence primeiro.' },
  { titulo: 'Clientes', texto: 'Centralize contatos e honorários para achar tudo em segundos.' },
  { titulo: 'Documentos', texto: 'Guarde minutas e peças em PDF vinculadas ao processo.' },
];

const fieldClass =
  'h-11 w-full rounded-sheet border border-line bg-sheet px-3 text-[15px] text-ink placeholder:text-muted focus:border-brand focus:outline-none';

type Status = { done: boolean };

export function Onboarding() {
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState(0);
  const [nome, setNome] = useState('');
  const [areas, setAreas] = useState<string[]>([]);
  const [tamanho, setTamanho] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    api<{ data: Status }>('/api/onboarding')
      .then((r) => {
        if (!alive) return;
        if (r.data.done) window.location.href = '/';
        else setLoading(false);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  function toggleArea(area: string) {
    setAreas((prev) => (prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]));
  }

  async function onSubmitEscritorio(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (nome.trim().length < 2) {
      setError('Informe o nome do escritório.');
      return;
    }
    setBusy(true);
    try {
      await api('/api/onboarding', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ nome: nome.trim(), areas, tamanho_equipe: tamanho }),
      });
      setStep(1);
    } catch {
      setError('Não foi possível salvar. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper font-sans">
        <p className="text-sm text-muted">Carregando…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-4 py-10 font-sans">
      <main className="w-full max-w-lg rounded-panel border border-line bg-sheet p-6 shadow-sheet sm:p-8">
        <Logo />
        <div className="mt-6 flex gap-1.5" aria-hidden="true">
          {[0, 1].map((i) => (
            <span key={i} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-brand' : 'bg-line'}`} />
          ))}
        </div>
        <p className="mt-3 text-sm text-muted">Etapa {step + 1} de 2</p>

        {step === 0 ? (
          <>
            <h1 className="mt-1 font-display text-xl font-semibold text-ink">Sobre o escritório</h1>
            <p className="mt-1 text-sm text-muted">Essas informações organizam o portal para a sua rotina.</p>
            <form onSubmit={onSubmitEscritorio} className="mt-4 space-y-4">
              <div>
                <label htmlFor="onb-nome" className="mb-1 block text-sm text-muted">Nome do escritório</label>
                <input
                  id="onb-nome"
                  type="text"
                  required
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className={fieldClass}
                  placeholder="Ex.: Silva & Prado Advocacia"
                />
              </div>
              <fieldset>
                <legend className="mb-2 text-sm text-muted">Áreas de atuação</legend>
                <div className="flex flex-wrap gap-2">
                  {AREAS.map((area) => {
                    const on = areas.includes(area);
                    return (
                      <button
                        key={area}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleArea(area)}
                        className={
                          on
                            ? 'rounded-stamp bg-brand px-3 py-1.5 text-sm font-semibold text-white'
                            : 'rounded-stamp border border-line bg-paper px-3 py-1.5 text-sm text-ink transition-colors hover:border-brand'
                        }
                      >
                        {area}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              <fieldset>
                <legend className="mb-2 text-sm text-muted">Tamanho da equipe</legend>
                <div className="flex flex-wrap gap-2">
                  {TAMANHOS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={tamanho === t}
                      onClick={() => setTamanho(t)}
                      className={
                        tamanho === t
                          ? 'rounded-stamp bg-brand px-3 py-1.5 text-sm font-semibold text-white'
                          : 'rounded-stamp border border-line bg-paper px-3 py-1.5 text-sm text-ink transition-colors hover:border-brand'
                      }
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </fieldset>
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
                {busy ? 'Salvando…' : 'Continuar'}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="mt-1 font-display text-xl font-semibold text-ink">O portal em 1 minuto</h1>
            <p className="mt-1 text-sm text-muted">Por onde começar {nome ? `na ${nome}` : ''}:</p>
            <ul className="mt-4 space-y-3">
              {TOUR.map((item) => (
                <li key={item.titulo} className="rounded-sheet border border-line bg-paper px-4 py-3">
                  <p className="text-[15px] font-semibold text-ink">{item.titulo}</p>
                  <p className="mt-0.5 text-sm text-muted">{item.texto}</p>
                </li>
              ))}
            </ul>
            <a
              href="/"
              className="mt-5 flex min-h-11 items-center justify-center rounded-stamp bg-brand px-4 text-[15px] font-semibold text-white transition-colors hover:bg-brand-deep"
            >
              Começar a usar o portal
            </a>
          </>
        )}
      </main>
    </div>
  );
}
