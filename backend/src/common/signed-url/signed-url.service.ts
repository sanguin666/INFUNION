import { createHmac, timingSafeEqual } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { requireJwtSecret } from '../../auth/jwt-secret.js';

/**
 * Links that open one private thing for a short while, with no login
 * attached: a document someone sent with a request, or their tax receipt.
 *
 * They exist because the thing opening them is a browser tab (the phone's,
 * or the dashboard's "open"), which cannot send the Authorization header
 * the API normally wants. So the API, having checked who is asking, hands
 * out a link that carries its own proof: the path, an expiry, and an HMAC
 * of both. Anyone holding the link can open it until it expires, which is
 * why they expire quickly and are never stored.
 *
 * The key is derived from JWT_SECRET but is not it, so a link's signature
 * can never be replayed as a login token or the other way round.
 */
@Injectable()
export class SignedUrlService {
  private readonly key: Buffer;

  constructor(configService: ConfigService) {
    this.key = createHmac('sha256', requireJwtSecret(configService))
      .update('infunion:signed-urls')
      .digest();
  }

  /** `path` with `exp` and `sig` query parameters appended. */
  sign(path: string, ttlSeconds = 60 * 60): string {
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}exp=${exp}&sig=${this.signature(path, exp)}`;
  }

  /** Whether `sig` is ours for this exact path and has not expired. */
  verify(path: string, exp: string | undefined, sig: string | undefined): boolean {
    const expiresAt = Number(exp);
    if (!sig || !Number.isInteger(expiresAt)) return false;
    if (expiresAt < Math.floor(Date.now() / 1000)) return false;
    const expected = Buffer.from(this.signature(path, expiresAt));
    const given = Buffer.from(sig);
    return expected.length === given.length && timingSafeEqual(expected, given);
  }

  private signature(path: string, exp: number): string {
    return createHmac('sha256', this.key).update(`${path}|${exp}`).digest('base64url');
  }
}
