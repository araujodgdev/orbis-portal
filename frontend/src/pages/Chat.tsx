// frontend/src/pages/Chat.tsx
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';

type Session = { id: string; titulo: string; updated_at: string };
type Msg = { id: string; remetente: 'user' | 'agent'; texto: string; estado: string; created_at: string };

const inputClass =
  'h-11 w-full rounded-sheet border border-line bg-sheet px-3 text-[15px] text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none';

export function Chat() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const loadSessions = useCallback(async (pick?: string) => {
    const r = await api<{ data: Session[] }>('/api/chat/sessions');
    setSessions(r.data);
    const id = pick ?? r.data[0]?.id ?? '';
    setActiveId((cur) => cur || id);
  }, []);

  const loadMsgs = useCallback(async (id: string) => {
    if (!id) return;
    const r = await api<{ data: Msg[] }>(`/api/chat/sessions/${encodeURIComponent(id)}/messages`);
    setMsgs(r.data);
  }, []);

  useEffect(() => { loadSessions().catch(() => setError('Não foi possível carregar os chats.')); }, [loadSessions]);
  useEffect(() => { loadMsgs(activeId).catch(() => {}); }, [activeId, loadMsgs]);
  useEffect(() => {
    if (!activeId) return;
    const t = setInterval(() => { if (!document.hidden) loadMsgs(activeId).catch(() => {}); }, 2500);
    return () => clearInterval(t);
  }, [activeId, loadMsgs]);

  async function newChat() {
    const r = await api<{ data: Session }>('/api/chat/sessions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
    setSessions((s) => [r.data, ...s]);
    setActiveId(r.data.id);
    setMsgs([]);
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    const texto = draft.trim();
    if (!texto || !activeId || busy) return;
    setBusy(true);
    setError('');
    try {
      await api(`/api/chat/sessions/${encodeURIComponent(activeId)}/messages`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texto }),
      });
      setDraft('');
      await loadMsgs(activeId);
    } catch {
      setError('Não foi possível enviar. Tente de novo.');
    } finally {
      setBusy(false);
    }
  }

  async function retry(mid: string) {
    setError('');
    try {
      await api(`/api/chat/sessions/${encodeURIComponent(activeId)}/messages/${encodeURIComponent(mid)}/retry`, { method: 'POST' });
      await loadMsgs(activeId);
    } catch {
      setError('Não foi possível reenviar. Tente de novo.');
    }
  }

  async function removeSession() {
    if (!activeId || !window.confirm('Excluir este chat e todas as mensagens?')) return;
    await api(`/api/chat/sessions/${encodeURIComponent(activeId)}`, { method: 'DELETE' });
    setSessions((s) => s.filter((x) => x.id !== activeId));
    setActiveId('');
    setMsgs([]);
  }

  async function rename() {
    const t = newTitle.trim();
    if (!t || !activeId) { setRenaming(false); return; }
    await api(`/api/chat/sessions/${encodeURIComponent(activeId)}`, {
      method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ titulo: t }),
    });
    setSessions((s) => s.map((x) => (x.id === activeId ? { ...x, titulo: t } : x)));
    setRenaming(false);
  }

  const active = sessions.find((s) => s.id === activeId);

  return (
    <main className="font-sans text-ink">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-semibold text-brand sm:text-3xl">Chat</h1>
        <button type="button" onClick={newChat} className="min-h-11 rounded-stamp bg-brand px-4 text-[15px] font-semibold text-white hover:bg-brand-deep">
          Novo chat
        </button>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-[280px_1fr]">
        <section aria-label="Conversas" className="flex max-h-64 flex-col gap-1 overflow-y-auto lg:max-h-none">
          {sessions.map((s) => (
            <button
              key={s.id} type="button" onClick={() => { setActiveId(s.id); setRenaming(false); }}
              aria-current={s.id === activeId ? 'true' : undefined}
              className={s.id === activeId ? 'min-h-11 rounded-sheet bg-brand/10 px-3 py-2 text-left text-[15px] font-semibold text-ink' : 'min-h-11 rounded-sheet px-3 py-2 text-left text-[15px] text-ink hover:bg-sheet'}
            >
              {s.titulo}
            </button>
          ))}
          {sessions.length === 0 && <p className="px-1 text-sm text-muted">Nenhum chat ainda.</p>}
        </section>
        <section aria-label="Mensagens" className="flex min-h-[50vh] flex-col gap-3">
          {active && (
            <div className="flex flex-wrap items-center gap-2">
              {renaming ? (
                <input aria-label="Nome do chat" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} onBlur={rename} onKeyDown={(e) => { if (e.key === 'Enter') rename(); }} autoFocus className={inputClass} />
              ) : (
                <button type="button" title="Renomear" onClick={() => { setNewTitle(active.titulo); setRenaming(true); }} className="min-h-11 text-left text-lg font-semibold">
                  {active.titulo}
                </button>
              )}
              <button type="button" onClick={removeSession} className="min-h-11 rounded-stamp px-3 text-sm font-semibold text-seal-deep hover:bg-seal-wash">
                Excluir
              </button>
            </div>
          )}
          <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
            {msgs.map((m) => (
              <div key={m.id} className={m.remetente === 'user' ? 'self-end rounded-sheet bg-brand px-3 py-2 text-[15px] text-white' : 'self-start rounded-sheet bg-sheet px-3 py-2 text-[15px]'}>
                <p className="whitespace-pre-wrap">{m.texto}</p>
                {m.remetente === 'user' && m.estado === 'pending' && <p className="mt-1 text-xs opacity-70">aguardando agente…</p>}
                {m.estado === 'error' && (
                  <button type="button" onClick={() => retry(m.id)} className="mt-1 min-h-11 text-xs font-semibold underline underline-offset-2">
                    Falhou — tentar de novo
                  </button>
                )}
              </div>
            ))}
          </div>
          {error && <p role="alert" className="rounded-stamp border border-seal/30 bg-seal-wash px-3 py-2 text-sm text-seal-deep">{error}</p>}
          <form onSubmit={send} className="flex gap-2">
            <input aria-label="Mensagem" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escreva…" className={inputClass} />
            <button type="submit" disabled={busy || !activeId} className="min-h-11 shrink-0 rounded-stamp bg-brand px-4 text-[15px] font-semibold text-white hover:bg-brand-deep disabled:opacity-60">
              {busy ? '…' : 'Enviar'}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
