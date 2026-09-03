// tests/processos.test.ts
import { describe, it, expect } from 'vitest';
import { isCNJ } from '../src/lib/validate';

describe('isCNJ', () => {
  it('accepts formatted CNJ and rejects junk', () => {
    expect(isCNJ('0000001-01.2026.8.26.0001')).toBe(true);
    expect(isCNJ('abc')).toBe(false);
  });
});
