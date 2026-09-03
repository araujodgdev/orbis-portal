// tests/processos.test.ts
import { describe, it, expect } from 'vitest';
import { isCNJ } from '../src/lib/validate';
import { isDateYYYYMMDD } from '../src/lib/validate';

describe('isCNJ', () => {
  it('accepts formatted CNJ and rejects junk', () => {
    expect(isCNJ('0000001-01.2026.8.26.0001')).toBe(true);
    expect(isCNJ('abc')).toBe(false);
    expect(isCNJ(undefined as never)).toBe(false);
  });
});

describe('isDateYYYYMMDD', () => {
  it('accepts real calendar dates and rejects corrupt strings', () => {
    expect(isDateYYYYMMDD('2026-09-10')).toBe(true);
    expect(isDateYYYYMMDD('10/09/2026')).toBe(false);
    expect(isDateYYYYMMDD('2026-9-1')).toBe(false);
    expect(isDateYYYYMMDD('2026-13-01')).toBe(false);
    expect(isDateYYYYMMDD('2026-02-30')).toBe(false);
    expect(isDateYYYYMMDD('qualquer')).toBe(false);
    expect(isDateYYYYMMDD(undefined as never)).toBe(false);
  });
});
