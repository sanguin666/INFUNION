import { describe, expect, it } from 'vitest';
import { taxSaving } from './taxDeduction';

describe('tax saving shown on the gift form', () => {
  it('follows the Ley 49/2002 bands', () => {
    expect(taxSaving('es_ley49', 50)).toBe(40);
    expect(taxSaving('es_ley49', 300)).toBe(220);
    expect(taxSaving('es_ley49', 300, { recurrent: true })).toBe(222.5);
    expect(taxSaving('es_ley49', 100, { alreadyGiven: 200 })).toBe(60);
  });

  it('gives 10 % outside it, and nothing without a scheme', () => {
    expect(taxSaving('es_art68', 50)).toBe(5);
    expect(taxSaving('none', 50)).toBe(0);
    expect(taxSaving(undefined, 50)).toBe(0);
  });
});
