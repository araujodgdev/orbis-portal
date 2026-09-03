// frontend/src/App.tsx
import { Dashboard } from './pages/Dashboard';
import { FichaProcesso } from './pages/FichaProcesso';
import { Processos } from './pages/Processos';
import { Clientes } from './pages/Clientes';
import { Noticias } from './pages/Noticias';
import { Login } from './pages/Login';

const NAV = [
  { href: '/', label: 'Início' },
  { href: '/processos', label: 'Processos' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/noticias', label: 'Notícias' },
];

function isActive(path: string, href: string, onFicha: boolean): boolean {
  if (href === '/processos') return path === '/processos' || onFicha;
  return path === href;
}

export function App() {
  const path = window.location.pathname;
  if (path === '/login') return <Login />;
  const m = path.match(/^\/processos\/([^/]+)/);
  const page = m
    ? <FichaProcesso id={decodeURIComponent(m[1])} />
    : path === '/processos' ? <Processos />
    : path === '/clientes' ? <Clientes />
    : path === '/noticias' ? <Noticias />
    : <Dashboard />;
  return (
    <div className="min-h-screen bg-paper font-sans text-ink">
      {/* Desktop: lombada fixa em azul tinta */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-brand lg:flex">
        <div className="border-b border-white/15 px-6 pt-7 pb-6">
          <p className="font-display text-3xl leading-none font-semibold text-white">Orbis</p>
          <p className="mt-2 text-sm text-white/65">Portal do escritório</p>
        </div>
        <nav aria-label="Navegação principal" className="flex-1 space-y-1 px-3 py-5">
          {NAV.map((item) => {
            const active = isActive(path, item.href, m !== null);
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'flex items-center gap-3 rounded-sheet bg-white/12 px-4 py-2.5 text-[15px] font-semibold text-white'
                    : 'flex items-center gap-3 rounded-sheet px-4 py-2.5 text-[15px] text-white/70 transition-colors hover:bg-white/5 hover:text-white'
                }
              >
                <span
                  aria-hidden="true"
                  className={active ? 'h-4 w-1 rounded-full bg-white' : 'h-4 w-1 rounded-full bg-transparent'}
                />
                {item.label}
              </a>
            );
          })}
        </nav>
        <p className="border-t border-white/15 px-6 py-4 text-xs leading-relaxed text-white/55">
          Uso interno do escritório
        </p>
      </aside>

      {/* Coluna de conteúdo */}
      <div className="lg:pl-60">
        {/* Cabeçalho compacto só no celular */}
        <header className="border-b border-line bg-paper px-4 pt-5 pb-4 lg:hidden">
          <p className="font-display text-2xl leading-none font-semibold text-brand">Orbis</p>
        </header>
        <div className="mx-auto w-full max-w-6xl px-4 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-10 lg:pb-16">
          {page}
        </div>
      </div>

      {/* Celular: barra de abas inferior */}
      <nav
        aria-label="Navegação principal"
        className="fixed inset-x-0 bottom-0 border-t border-line bg-sheet pb-[env(safe-area-inset-bottom)] shadow-lift lg:hidden"
      >
        <div className="grid grid-cols-4">
          {NAV.map((item) => {
            const active = isActive(path, item.href, m !== null);
            return (
              <a
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={
                  active
                    ? 'border-t-2 border-brand px-1 py-3 text-center text-sm font-semibold text-brand'
                    : 'border-t-2 border-transparent px-1 py-3 text-center text-sm text-muted'
                }
              >
                {item.label}
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
