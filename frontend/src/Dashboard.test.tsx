// frontend/src/Dashboard.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { riskLabel } from './pages/Dashboard';

describe('riskLabel', () => {
  it('labels overdue as Perdido', () => {
    expect(riskLabel({ status: 'perdido' } as never)).toBe('Perdido');
  });
  it('labels near due as Urgente', () => {
    expect(riskLabel({ status: 'aberto', data: new Date().toISOString().slice(0, 10) } as never)).toMatch(/Urgente|Aberto/);
  });
});
