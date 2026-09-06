// frontend/src/App.tsx
import { Dashboard } from './pages/Dashboard';
import { FichaProcesso } from './pages/FichaProcesso';
import { Processos } from './pages/Processos';
import { Clientes } from './pages/Clientes';
import { Noticias } from './pages/Noticias';
import { NoticiaDetalhe } from './pages/NoticiaDetalhe';
import { Login } from './pages/Login';
import { Cadastro } from './pages/Cadastro';
import { Onboarding } from './pages/Onboarding';
import { ClienteNovo } from './pages/ClienteNovo';
import { ClienteFicha } from './pages/ClienteFicha';
import { ClienteEditar } from './pages/ClienteEditar';
import { ProcessoNovo } from './pages/ProcessoNovo';
import { ProcessoEditar } from './pages/ProcessoEditar';
import { Chat } from './pages/Chat';
import { ChatWidget } from './components/ChatWidget';
import { Logo } from './components/Logo';

const NAV = [
  { href: '/', label: 'Início' },
  { href: '/processos', label: 'Processos' },
  { href: '/clientes', label: 'Clientes' },
  { href: '/noticias', label: 'Notícias' },
];

async function logout(): Promise<void> {
  try {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
  } finally {
    window.location.href = '/login';
  }
}

function LogoutIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      className={className}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9"
      />
    </svg>
  );
}

function isActive(path: string, href: string): boolean {
  if (href === '/processos') return path === '/processos' || path.startsWith('/processos/');
  if (href === '/noticias') return path === '/noticias' || path.startsWith('/noticias/');
  return path === href;
}

export function App() {
  const path = window.location.pathname;
  if (path === '/login') return <Login />;
  if (path === '/chat') return <Chat />;
  if (path === '/cadastro') return <Cadastro />;
  if (path === '/boas-vindas') return <Onboarding />;
  if (path === '/clientes/novo') return <ClienteNovo />;
  if (path === '/processos/novo') return <ProcessoNovo />;
  const cliEdit = path.match(/^\/clientes\/([^/]+)\/editar$/);
  const procEdit = path.match(/^\/processos\/([^/]+)\/editar$/);
  const cliFicha = path.match(/^\/clientes\/([^/]+)$/);
  const m = path.match(/^\/processos\/([^/]+)/);
  const nm = path.match(/^\/noticias\/([^/]+)/);
  const page = procEdit
    ? <ProcessoEditar id={decodeURIComponent(procEdit[1])} />
    : cliEdit
    ? <ClienteEditar id={decodeURIComponent(cliEdit[1])} />
    : m
    ? <FichaProcesso id={decodeURIComponent(m[1])} />
    : nm
    ? <NoticiaDetalhe id={decodeURIComponent(nm[1])} />
    : path === '/processos' ? <Processos />
    : path === '/clientes' ? <Clientes />
    : cliFicha ? <ClienteFicha id={decodeURIComponent(cliFicha[1])} />
    : path === '/noticias' ? <Noticias />
    : <Dashboard />;
  return (
    <div className="min-h-screen bg-paper font-sans text-ink">
      {/* Desktop: lombada fixa em azul tinta */}
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col bg-brand lg:flex">
        <div className="border-b border-white/15 px-6 pt-7 pb-6">
          <Logo variant="light" />
          <p className="mt-2 text-sm text-white/65">Portal do escritório</p>
        </div>
        <nav aria-label="Navegação principal" className="flex-1 space-y-1 px-3 py-5">
          {NAV.map((item) => {
            const active = isActive(path, item.href);
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
        <div className="border-t border-white/15 px-3 py-4">
          <button
            type="button"
            onClick={logout}
            className="flex w-full cursor-pointer items-center gap-3 rounded-sheet px-4 py-2.5 text-left text-[15px] text-white/70 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogoutIcon className="h-5 w-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Coluna de conteúdo */}
      <div className="lg:pl-60">
        {/* Cabeçalho compacto só no celular */}
        <header className="flex items-center justify-between border-b border-line bg-paper px-4 pt-5 pb-4 lg:hidden">
          <Logo />
          <button
            type="button"
            onClick={logout}
            className="flex cursor-pointer items-center gap-1.5 rounded-stamp px-3 py-1.5 text-sm font-semibold text-brand"
          >
            <LogoutIcon className="h-4 w-4" />
            Sair
          </button>
        </header>
        <div className="mx-auto w-full max-w-6xl px-5 pt-5 pb-28 sm:px-6 lg:px-8 lg:pt-10 lg:pb-16">
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
            const active = isActive(path, item.href);
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
      <ChatWidget />
    </div>
  );
}
