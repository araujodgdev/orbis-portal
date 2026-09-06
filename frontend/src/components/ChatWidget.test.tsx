// @vitest-environment jsdom
// frontend/src/components/ChatWidget.test.tsx
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { ChatWidget } from './ChatWidget';

afterEach(() => { vi.unstubAllGlobals(); });

describe('ChatWidget', () => {
  it('opens panel and loads sessions on click', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [] }) })) as never;
    vi.stubGlobal('fetch', fetchMock);
    const div = document.createElement('div');
    document.body.appendChild(div);
    const root = createRoot(div);
    act(() => { root.render(<ChatWidget />); });
    const btn = div.querySelector('button[aria-label="Abrir chat"]') as HTMLButtonElement;
    expect(btn).not.toBeNull();
    act(() => { btn.click(); });
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledWith('/api/chat/sessions', expect.anything());
    expect(div.textContent).toContain('Abrir página');
    act(() => { root.unmount(); });
    div.remove();
  });
});
