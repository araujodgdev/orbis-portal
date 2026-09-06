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
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      if (url.includes('/messages') && init?.method === 'POST') {
        return { ok: true, status: 201, json: async () => ({ data: { id: 'chm_9', estado: 'pending' } }) };
      }
      if (url.includes('/messages')) {
        return { ok: true, status: 200, json: async () => ({ data: [] }) };
      }
      return { ok: true, status: 200, json: async () => ({ data: [{ id: 'cht_1', titulo: 'Dúvida prazo', updated_at: 'x' }] }) };
    }) as never);
    const { asyncFlush, unmount } = render(<Chat />);
    await asyncFlush();
    const input = document.querySelector('input[aria-label="Mensagem"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, 'Qual o prazo?');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => {
      document.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    await asyncFlush();
    const post = calls.find((c) => c.url.includes('/messages') && c.init?.method === 'POST');
    expect(post).toBeDefined();
    expect(post!.init!.body as string).toContain('Qual o prazo?');
    unmount();
  });
  it('links back to Início', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) })) as never);
    const { asyncFlush, unmount } = render(<Chat />);
    await asyncFlush();
    const home = document.querySelector('a[href="/"]');
    expect(home?.textContent).toContain('Início');
    unmount();
  });
  it('pauses polling while the tab is hidden', async () => {
    vi.useFakeTimers();
    try {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      const fetchMock = vi.fn(async (url: string) => ({
        ok: true, status: 200,
        json: async () => url.endsWith('/sessions')
          ? { data: [{ id: 'cht_1', titulo: 'Chat', updated_at: 'x' }] }
          : { data: [] },
      })) as never;
      vi.stubGlobal('fetch', fetchMock);
      const { unmount } = render(<Chat />);
      await act(async () => {});
      await act(async () => {});
      fetchMock.mockClear();
      await act(async () => { vi.advanceTimersByTime(10000); });
      expect(fetchMock).not.toHaveBeenCalled();
      Object.defineProperty(document, 'hidden', { value: false, configurable: true });
      await act(async () => { vi.advanceTimersByTime(3000); });
      expect(fetchMock).toHaveBeenCalled();
      unmount();
    } finally {
      delete (document as unknown as Record<string, unknown>).hidden;
      vi.useRealTimers();
    }
  });
  it('shows PT-BR feedback when creating a chat fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === 'POST') return { ok: false, status: 500, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ data: [] }) };
    }) as never);
    const { asyncFlush, unmount } = render(<Chat />);
    await asyncFlush();
    const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Novo chat')!;
    expect(btn).toBeTruthy();
    await act(async () => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    await asyncFlush();
    expect(document.body.textContent).toContain('Não foi possível criar o chat.');
    unmount();
  });
  it('shows PT-BR feedback when deleting a chat fails', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    try {
      vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
        if (init?.method === 'DELETE') return { ok: false, status: 500, json: async () => ({}) };
        return {
          ok: true, status: 200,
          json: async () => url.endsWith('/sessions')
            ? { data: [{ id: 'cht_1', titulo: 'Chat', updated_at: 'x' }] }
            : { data: [] },
        };
      }) as never);
      const { asyncFlush, unmount } = render(<Chat />);
      await asyncFlush();
      await asyncFlush();
      const btn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Excluir')!;
      expect(btn).toBeTruthy();
      await act(async () => { btn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
      await asyncFlush();
      expect(document.body.textContent).toContain('Não foi possível excluir o chat.');
      unmount();
    } finally {
      confirm.mockRestore();
    }
  });
  it('shows PT-BR feedback when renaming a chat fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PATCH') return { ok: false, status: 500, json: async () => ({}) };
      return {
        ok: true, status: 200,
        json: async () => url.endsWith('/sessions')
          ? { data: [{ id: 'cht_1', titulo: 'Chat', updated_at: 'x' }] }
          : { data: [] },
      };
    }) as never);
    const { asyncFlush, unmount } = render(<Chat />);
    await asyncFlush();
    await asyncFlush();
    const titleBtn = document.querySelector('button[title="Renomear"]') as HTMLButtonElement;
    expect(titleBtn).toBeTruthy();
    await act(async () => { titleBtn.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
    const input = document.querySelector('input[aria-label="Nome do chat"]') as HTMLInputElement;
    expect(input).toBeTruthy();
    await act(async () => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(input, 'Novo nome');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await act(async () => { input.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })); });
    await asyncFlush();
    expect(document.body.textContent).toContain('Não foi possível renomear o chat.');
    unmount();
  });
});
