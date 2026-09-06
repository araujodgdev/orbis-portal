// @vitest-environment jsdom
// frontend/src/pages/Chat.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { Chat } from './Chat';

function render(el: React.ReactElement) {
  const div = document.createElement('div');
  document.body.appendChild(div);
  const root = createRoot(div);
  act(() => { root.render(el); });
  return { asyncFlush: () => act(async () => {}), unmount: () => { act(() => { root.unmount(); }); div.remove(); } };
}

afterEach(() => { vi.unstubAllGlobals(); });

describe('Chat page', () => {
  it('lists sessions and messages', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => ({
      ok: true, status: 200,
      json: async () => url.endsWith('/sessions')
        ? { data: [{ id: 'cht_1', titulo: 'Dúvida prazo', updated_at: 'x' }] }
        : { data: [{ id: 'chm_1', remetente: 'agent', texto: 'O prazo é dia 12.', estado: 'delivered', created_at: 'x' }] },
    })) as never);
    const { asyncFlush, unmount } = render(<Chat />);
    await asyncFlush();
    expect(document.body.textContent).toContain('Dúvida prazo');
    expect(document.body.textContent).toContain('O prazo é dia 12.');
    unmount();
  });
  it('sends a message via POST', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) })) as never;
    vi.stubGlobal('fetch', fetchMock);
    const { asyncFlush, unmount } = render(<Chat />);
    await asyncFlush();
    unmount();
    expect(fetchMock).toHaveBeenCalledWith('/api/chat/sessions', expect.objectContaining({ credentials: 'include' }));
  });
});
