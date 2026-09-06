// frontend/src/components/ChatWidget.tsx
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api } from '../lib/api';

type Session = { id: string; titulo: string };
type Msg = { id: string; remetente: 'user' | 'agent'; texto: string; estado: string };

const inputClass =
  'h-11 w-full rounded-sheet border border-line bg-sheet px-3 text-[15px] text-ink placeholder:text-muted/70 focus:border-brand focus:outline-none';

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState('');
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  const loadMsgs = useCallback(async (id: string) => {
    if (!id) return;
    const r = await api<{ data: Msg[] }>(`/api/chat/sessions/${encodeURIComponent(id)}/messages`);
    setMsgs(r.data);
  }, []);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && sessions.length === 0) {
      try {
        const r = await api<{ data: Session[] }>('/api/chat/sessions');
        setSessions(r.data);
        if (r.data[0]) { setActiveId(r.data[0].id); await loadMsgs(r.data[0].id); }
      } catch { /* painel abre vazio; retry no próximo abrir */ }
    }
  }

  useEffect(() => {
    if (!open || !activeId) return;
    const t = setInterval(() => { if (!document.hidden) loadMsgs(activeId).catch(() => {}); }, 2500);
    return () => clearInterval(t);
  }, [open, activeId, loadMsgs]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const texto = draft.trim();
    if (!texto || !activeId || busy) return;
    setBusy(true);
    try {
      await api(`/api/chat/sessions/${encodeURIComponent(activeId)}/messages`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ texto }),
      });
      setDraft('');
      await loadMsgs(activeId);
    } catch { /* mantém o rascunho para reenvio */ } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed right-4 bottom-24 z-50 flex flex-col items-end gap-2 lg:bottom-6">
      {open && (
        <section aria-label="Chat" className="flex max-h-[65vh] w-[min(380px,calc(100vw-2rem))] flex-col gap-2 rounded-sheet border border-line bg-paper p-3 shadow-lift">
          <div className="flex items-center gap-2">
            <select
              aria-label="Conversa" value={activeId}
              onChange={(e) => { setActiveId(e.target.value); loadMsgs(e.target.value).catch(() => {}); }}
              className={inputClass}
            >
              {sessions.map((s) => <option key={s.id} value={s.id}>{s.titulo}</option>)}
            </select>
            <a href="/chat" className="min-h-11 shrink-0 rounded-stamp px-2 text-sm font-semibold text-brand hover:underline">
              Abrir página
            </a>
          </div>
          <div className="flex min-h-40 flex-col gap-2 overflow-y-auto px-1 py-1">
            {msgs.map((m) => (
              <div key={m.id} className={m.remetente === 'user' ? 'self-end rounded-sheet bg-brand px-3 py-2 text-sm text-white' : 'self-start rounded-sheet bg-sheet px-3 py-2 text-sm'}>
                <p className="whitespace-pre-wrap">{m.texto}</p>
                {m.remetente === 'user' && m.estado === 'pending' && <p className="mt-1 text-xs opacity-70">aguardando agente…</p>}
              </div>
            ))}
            {msgs.length === 0 && <p className="px-1 text-sm text-muted">Sem mensagens ainda.</p>}
          </div>
          <form onSubmit={send} className="flex gap-2">
            <input aria-label="Mensagem" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Escreva…" className={inputClass} />
            <button type="submit" disabled={busy || !activeId} className="min-h-11 shrink-0 rounded-stamp bg-brand px-3 text-sm font-semibold text-white hover:bg-brand-deep disabled:opacity-60">
              Enviar
            </button>
          </form>
        </section>
      )}
      <button
        type="button" onClick={toggle} aria-label={open ? 'Fechar chat' : 'Abrir chat'}
        className="flex min-h-11 min-w-11 items-center justify-center rounded-full bg-brand px-4 text-[15px] font-semibold text-white shadow-lift hover:bg-brand-deep"
      >
        {open ? '✕' : 'Chat'}
      </button>
    </div>
  );
}
