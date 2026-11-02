import {
  closesAtFrom,
  giftsBlockedUntil,
  lastAnonymisableGiftYear,
  recordsEndAt,
} from './closure-rules.js';

describe('closure rules', () => {
  it('closes thirty days after the request', () => {
    expect(closesAtFrom(new Date('2026-11-02T20:00:00Z')).toISOString()).toBe(
      '2026-12-02T20:00:00.000Z',
    );
  });

  it('keeps a year of gifts past the tax office’s four years', () => {
    // 2026 gifts: modelo 182 filed by 31 Jan 2027, checkable until 31 Jan 2031.
    expect(giftsBlockedUntil(2026).toISOString()).toBe(
      '2031-07-01T00:00:00.000Z',
    );
    expect(lastAnonymisableGiftYear(new Date('2031-06-30T00:00:00Z'))).toBe(
      2025,
    );
    expect(lastAnonymisableGiftYear(new Date('2031-07-01T00:00:00Z'))).toBe(
      2026,
    );
  });

  it('keeps the closed place’s records six years', () => {
    expect(recordsEndAt(new Date('2026-12-02T20:00:00Z')).toISOString()).toBe(
      '2032-12-02T20:00:00.000Z',
    );
  });
});
