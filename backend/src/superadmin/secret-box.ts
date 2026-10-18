import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for the superadmin's authenticator secret, so a copy of the
 * database alone is not enough to produce codes. The key comes from
 * SUPERADMIN_SECRET_KEY, or else from JWT_SECRET (which a database dump
 * doesn't carry either).
 */
function key(material: string): Buffer {
  return createHash('sha256').update(`ansae-superadmin-totp:${material}`).digest();
}

export function seal(plain: string, material: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(material), iv);
  const body = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), body.toString('base64')].join('.');
}

export function open(sealed: string, material: string): string {
  const [version, iv, tag, body] = sealed.split('.');
  if (version !== 'v1' || !iv || !tag || !body) throw new Error('Unreadable secret');
  const decipher = createDecipheriv('aes-256-gcm', key(material), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(body, 'base64')), decipher.final()]).toString('utf8');
}
