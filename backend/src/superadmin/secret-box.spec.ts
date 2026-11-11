import { createCipheriv, createHash, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { isLegacy, open, seal } from './secret-box.js';

// Seals the way the app did before the rename, with the old key prefix.
function sealLegacy(plain: string, material: string): string {
  const key = createHash('sha256').update(`ansae-superadmin-totp:${material}`).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), body.toString('base64')].join('.');
}

describe('secret box', () => {
  it('opens what it seals', () => {
    const sealed = seal('JBSWY3DPEHPK3PXP', 'material');
    expect(open(sealed, 'material')).toBe('JBSWY3DPEHPK3PXP');
    expect(isLegacy(sealed, 'material')).toBe(false);
  });

  it('still opens a secret sealed before the rename, and flags it for resealing', () => {
    const sealed = sealLegacy('JBSWY3DPEHPK3PXP', 'material');
    expect(open(sealed, 'material')).toBe('JBSWY3DPEHPK3PXP');
    expect(isLegacy(sealed, 'material')).toBe(true);
  });

  it('refuses the wrong material', () => {
    expect(() => open(seal('x', 'material'), 'other')).toThrow();
    expect(isLegacy(seal('x', 'material'), 'other')).toBe(false);
  });
});
