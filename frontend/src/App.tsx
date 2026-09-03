// frontend/src/App.tsx
import { Dashboard } from './pages/Dashboard';
import { FichaProcesso } from './pages/FichaProcesso';

export function App() {
  const path = window.location.pathname;
  const m = path.match(/^\/processos\/([^/]+)/);
  return (
    <div style={{ background: '#f6f4ee', minHeight: '100vh' }}>
      {m ? <FichaProcesso id={decodeURIComponent(m[1])} /> : <Dashboard />}
      <nav style={{ position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-around', padding: '12px 12px calc(12px + env(safe-area-inset-bottom))', borderTop: '1px solid #e2dccc', background: '#fff' }}>
        <a href="/" style={{ color: '#1e3a5f', fontWeight: 700, textDecoration: 'none' }}>Início</a><a href="/processos" style={{ color: '#1c2430', textDecoration: 'none' }}>Processos</a><a href="/clientes" style={{ color: '#1c2430', textDecoration: 'none' }}>Clientes</a><a href="/noticias" style={{ color: '#1c2430', textDecoration: 'none' }}>Notícias</a>
      </nav>
    </div>
  );
}
