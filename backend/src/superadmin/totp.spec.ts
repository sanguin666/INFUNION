import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, generateTotpSecret, totpCode, totpStep, verifyTotp } from './totp.js';

// RFC 6238 appendix B: the SHA-1 secret is the ASCII "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from('12345678901234567890'));

describe('totp', () => {
  it('matches the RFC 6238 test vectors (last six digits)', () => {
    expect(totpCode(RFC_SECRET, Math.floor(59 / 30))).toBe('287082');
    expect(totpCode(RFC_SECRET, Math.floor(1111111109 / 30))).toBe('081804');
    expect(totpCode(RFC_SECRET, Math.floor(1234567890 / 30))).toBe('005924');
    expect(totpCode(RFC_SECRET, Math.floor(2000000000 / 30))).toBe('279037');
  });

  it('round-trips base32', () => {
    const secret = generateTotpSecret();
    expect(secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(secret))).toBe(secret);
  });

  it('accepts the current code and one step either side, nothing further', () => {
    const now = new Date('2026-10-17T10:00:00Z');
    const step = totpStep(now);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step), now)).toBe(step);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 1), now)).toBe(step - 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 1), now)).toBe(step + 1);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step - 2), now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, 'abcdef', now)).toBeNull();
  });

  it('refuses a code already used', () => {
    const now = new Date('2026-10-17T10:00:00Z');
    const step = totpStep(now);
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step), now, step)).toBeNull();
    expect(verifyTotp(RFC_SECRET, totpCode(RFC_SECRET, step + 1), now, step)).toBe(step + 1);
  });
});
