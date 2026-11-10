import { describe, expect, it } from 'vitest';
import { linkOpen, newCode, todayInMadrid } from './payment-links.service.js';

describe('payment links', () => {
  it('makes short codes without look-alike characters', () => {
    for (let i = 0; i < 200; i += 1) {
      const code = newCode();
      expect(code).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
    }
  });

  it('takes payments until the end of its last day, then stops', () => {
    expect(linkOpen({ archivedAt: null, endsOn: null }, '2026-12-21')).toBe(true);
    expect(linkOpen({ archivedAt: null, endsOn: '2026-12-20' }, '2026-12-20')).toBe(true);
    expect(linkOpen({ archivedAt: null, endsOn: '2026-12-20' }, '2026-12-21')).toBe(false);
    expect(linkOpen({ archivedAt: new Date(), endsOn: null }, '2026-12-01')).toBe(false);
  });

  it("counts days in Madrid's time", () => {
    // 23:30 UTC on 20 Dec is already 21 Dec in Madrid.
    expect(todayInMadrid(new Date('2026-12-20T23:30:00Z'))).toBe('2026-12-21');
  });
});
