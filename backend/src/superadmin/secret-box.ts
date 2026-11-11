import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for the superadmin's authenticator secret, so a copy of the
 * database alone is not enough to produce codes. The key comes from
 * SUPERADMIN_SECRET_KEY, or else from JWT_SECRET (which a database dump
 * doesn't carry either).
 */
function key(material: string, prefix = 'infunion'): Buffer {
  return createHash('sha256').update(`${prefix}-superadmin-totp:${material}`).digest();
}

// The app's previous name. Secrets sealed before the rename (November 2026)
// still open with it; isLegacy() tells the caller to seal them again with
// the current key. Remove once every stored secret has been resealed.
const LEGACY_PREFIX = 'ansae';

export function seal(plain: string, material: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(material), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), body.toString('base64')].join('.');
}

function openWith(sealed: string, k: Buffer): string {
  const [version, iv, tag, body] = sealed.split('.');
  if (version !== 'v1' || !iv || !tag || !body) throw new Error('Unreadable secret');
  const decipher = createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8');
}

export function open(sealed: string, material: string): string {
  try {
    return openWith(sealed, key(material));
  } catch (error) {
    if (!isLegacy(sealed, material)) throw error;
    return openWith(sealed, key(material, LEGACY_PREFIX));
  }
}

/** Whether `sealed` only opens with the pre-rename key, and should be sealed again. */
export function isLegacy(sealed: string, material: string): boolean {
  try {
    openWith(sealed, key(material));
    return false;
  } catch {
    try {
      openWith(sealed, key(material, LEGACY_PREFIX));
      return true;
    } catch {
      return false;
    }
  }
}
