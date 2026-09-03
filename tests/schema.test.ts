// tests/schema.test.ts
import { describe, it, expect } from 'vitest';

describe('D1 schema', () => {
  it('seedDemo exports a function', async () => {
    const m = await import('../src/seed');
    expect(typeof m.seedDemo).toBe('function');
  });
});
