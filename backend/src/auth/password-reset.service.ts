import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import * as bcrypt from 'bcryptjs';
import { createHash } from 'node:crypto';
import { UsersService } from '../users/users.service.js';
import { EmailSender } from './email/email-sender.js';
import { passwordResetEmail } from './email/password-reset-email.js';
import { requireJwtSecret } from './jwt-secret.js';
import { LoginThrottle, adminLoginThrottle } from './login-throttle.js';
import { SuperadminAccess } from './superadmin-access.service.js';
import { MIN_SUPERADMIN_PASSWORD } from '../superadmin/superadmin-bootstrap.service.js';
import type { Language } from '../common/enums/language.enum.js';

export const MIN_ADMIN_PASSWORD = 8;
const LINK_SECONDS = 60 * 60;
const AUDIENCE = 'infunion-password-reset';
// Three links an hour for one address: enough for "it didn't arrive",
// not enough to flood someone's inbox.
const requestThrottle = new LoginThrottle('password-reset', 3, 60 * 60_000, 60 * 60_000);

/**
 * "Forgot your password?" on the admin dashboard (Seb, 5 Nov 2026), the
 * same for community admins and the superadmin.
 *
 * The link carries a token signed with a key made from JWT_SECRET *and*
 * the account's current password hash. So it:
 * - can never pass as a sign-in token (JwtAuthGuard checks JWT_SECRET alone);
 * - works once: the new password changes the hash, and the key with it;
 * - dies after an hour.
 * No table needed. Setting a new password only replaces the password: the
 * superadmin still types the authenticator code after signing in.
 */
@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger('PasswordReset');

  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailSender,
    private readonly access: SuperadminAccess,
  ) {}

  /** Always answers the same, so it can't tell who has an account. */
  async requestLink(emailAddress: string, language: Language | undefined, request?: Request): Promise<void> {
    const key = emailAddress.trim().toLowerCase();
    if ((await requestThrottle.lockedFor(key)) > 0) return;
    await requestThrottle.fail(key);
    const found = await this.users.findByEmailForLogin(key);
    // Members sign in with a code and have no password to reset.
    if (!found?.passwordHash) return;
    const user = await this.users.findByIdForPasswordReset(found.id);
    if (!user?.passwordHash || !user.email) return;
    const token = await this.jwt.signAsync(
      { sub: user.id },
      { audience: AUDIENCE, expiresIn: LINK_SECONDS, secret: this.keyFor(user.passwordHash) },
    );
    const link = `${this.dashboardUrl()}/reset-password?token=${encodeURIComponent(token)}`;
    try {
      await this.email.send(passwordResetEmail(user.email, link, language));
    } catch (err) {
      this.logger.error(`Reset email to ${user.email} failed: ${(err as Error).message}`);
      return;
    }
    if (!this.email.delivers) this.logger.log(`Reset link for ${user.email}: ${link}`);
    await this.access.record({ action: 'admin.password.reset.requested', actorId: user.id, actorEmail: key, request });
  }

  /** Whether a link still works, and how long the new password must be. */
  async check(token: string): Promise<{ valid: boolean; minLength: number }> {
    const user = await this.userFor(token);
    return { valid: !!user, minLength: user ? this.minLength(user.isSuperadmin) : MIN_ADMIN_PASSWORD };
  }

  async reset(token: string, password: string, request?: Request): Promise<void> {
    const user = await this.userFor(token);
    if (!user) throw new BadRequestException('reset_link_invalid');
    const min = this.minLength(user.isSuperadmin);
    if (password.length < min) throw new BadRequestException('password_too_short');
    await this.users.setPasswordHash(user.id, await bcrypt.hash(password, 12));
    const key = (user.email ?? '').toLowerCase();
    // A fresh password opens a locked-out sign-in straight away.
    await adminLoginThrottle.succeed(key);
    await this.access.record({ action: 'admin.password.reset', actorId: user.id, actorEmail: key, request });
  }

  private async userFor(token: string) {
    const sub = this.jwt.decode<{ sub?: unknown } | null>(token)?.sub;
    if (typeof sub !== 'string' || !sub) return null;
    const user = await this.users.findByIdForPasswordReset(sub).catch(() => null);
    if (!user?.passwordHash) return null;
    try {
      await this.jwt.verifyAsync(token, { audience: AUDIENCE, secret: this.keyFor(user.passwordHash) });
      return user;
    } catch {
      return null;
    }
  }

  private minLength(isSuperadmin: boolean): number {
    return isSuperadmin ? MIN_SUPERADMIN_PASSWORD : MIN_ADMIN_PASSWORD;
  }

  private keyFor(passwordHash: string): string {
    return createHash('sha256')
      .update(`${requireJwtSecret(this.config)}:password-reset:${passwordHash}`)
      .digest('hex');
  }

  /** ADMIN_URL, else the admin origin in CORS_ORIGINS, else production's. */
  private dashboardUrl(): string {
    const configured = this.config.get<string>('ADMIN_URL')?.trim();
    if (configured) return configured.replace(/\/$/, '');
    const fromCors = (this.config.get<string>('CORS_ORIGINS') ?? '')
      .split(',')
      .map((o) => o.trim())
      .find((o) => o.includes('admin'));
    return (fromCors ?? 'https://infunion-admin.up.railway.app').replace(/\/$/, '');
  }
}
