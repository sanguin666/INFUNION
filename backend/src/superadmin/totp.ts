import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Time-based one-time codes (RFC 6238), the six digits an authenticator
 * app (Google Authenticator, 1Password, ...) shows every 30 seconds. Written
 * out rather than pulled from a package: it is forty lines and it guards
 * the most powerful account there is.
 */
const STEP_SECONDS = 30;
const DIGITS = 6;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer: Buffer): string {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

export function base32Decode(text: string): Buffer {
  const clean = text.replace(/=+$/, '').replace(/\s/g, '').toUpperCase();
  let bits = 0;
  let value = 0;
  const bytes: number[] = [];
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index < 0) throw new Error('Invalid base32');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

/** 160 random bits, the size RFC 4226 recommends. */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function totpStep(now: Date): number {
  return Math.floor(now.getTime() / 1000 / STEP_SECONDS);
}

export function totpCode(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const hmac = createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const binary = hmac.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 10 ** DIGITS).padStart(DIGITS, '0');
}

/**
 * The step the code belongs to, or null. One step either side is allowed
 * for a phone clock a little off; a step at or before `lastStep` is refused,
 * so a code seen over someone's shoulder can't be used a second time.
 */
export function verifyTotp(secret: string, code: string, now: Date, lastStep?: number | null): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const current = totpStep(now);
  for (const step of [current - 1, current, current + 1]) {
    if (lastStep != null && step <= lastStep) continue;
    const expected = Buffer.from(totpCode(secret, step));
    if (timingSafeEqual(expected, Buffer.from(code))) return step;
  }
  return null;
}

export function otpauthUrl(secret: string, account: string): string {
  const label = encodeURIComponent(`ANSAE Superadmin:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent('ANSAE Superadmin')}&digits=${DIGITS}&period=${STEP_SECONDS}`;
}
