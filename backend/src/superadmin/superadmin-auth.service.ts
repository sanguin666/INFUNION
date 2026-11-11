import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type { Request } from 'express';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/entities/user.entity.js';
import {
  SUPERADMIN_AUDIENCE,
  SUPERADMIN_SESSION_SECONDS,
  SuperadminAccess,
  type SuperadminIdentity,
} from '../auth/superadmin-access.service.js';
import { LoginThrottle } from '../auth/login-throttle.js';
import { requireJwtSecret } from '../auth/jwt-secret.js';
import { generateTotpSecret, otpauthUrl, verifyTotp } from './totp.js';
import { isLegacy, open, seal } from './secret-box.js';
import { MIN_SUPERADMIN_PASSWORD } from './superadmin-bootstrap.service.js';

// Five wrong codes (or passwords) in 15 minutes locks the superadmin for 15.
const codeThrottle = new LoginThrottle('superadmin-code', 5, 15 * 60_000, 15 * 60_000);

export type SuperadminSession = { token: string; expiresAt: string };

/**
 * The superadmin's second step: after the ordinary password sign-in, a
 * six-digit code from an authenticator app buys a superadmin token good
 * for an hour. Setting the app up asks for the password again, so an
 * ordinary session left open somewhere can't register an attacker's phone.
 */
@Injectable()
export class SuperadminAuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly access: SuperadminAccess,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  private material(): string {
    return this.config.get<string>('SUPERADMIN_SECRET_KEY') || requireJwtSecret(this.config);
  }

  private load(userId: string) {
    return this.users.findOneOrFail({
      where: { id: userId },
      select: { id: true, email: true, passwordHash: true, totpSecret: true, totpPendingSecret: true, totpLastStep: true },
    });
  }

  private async guardAttempts(key: string): Promise<void> {
    if ((await codeThrottle.lockedFor(key)) > 0) {
      throw new HttpException('Too many attempts. Try again in 15 minutes.', HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  /**
   * SUPERADMIN_2FA=off (Seb, 3 Nov 2026) skips the authenticator code for
   * now: the password sign-in alone then opens the superadmin section.
   * Anything else, or no variable, keeps the code step.
   */
  codeRequired(): boolean {
    return (this.config.get<string>('SUPERADMIN_2FA') ?? '').trim().toLowerCase() !== 'off';
  }

  async status(identity: SuperadminIdentity) {
    const user = await this.load(identity.userId);
    return { email: identity.email, enrolled: !!user.totpSecret, codeRequired: this.codeRequired() };
  }

  /** The superadmin token without a code, only while SUPERADMIN_2FA=off. */
  async openWithoutCode(identity: SuperadminIdentity, request: Request): Promise<SuperadminSession> {
    if (this.codeRequired()) throw new BadRequestException('code_required');
    await this.access.record({ action: 'superadmin.login', actorId: identity.userId, actorEmail: identity.email, request });
    return this.issue(identity);
  }

  async startEnrollment(identity: SuperadminIdentity, password: string, request: Request) {
    const key = `superadmin:${identity.userId}`;
    await this.guardAttempts(key);
    const user = await this.load(identity.userId);
    if (user.totpSecret) throw new ConflictException('already_enrolled');
    if (!user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      await codeThrottle.fail(key);
      await this.access.record({ action: 'superadmin.2fa.enroll.failed', actorId: identity.userId, actorEmail: identity.email, request });
      throw new UnauthorizedException('wrong_password');
    }
    const secret = generateTotpSecret();
    await this.users.update(identity.userId, { totpPendingSecret: seal(secret, this.material()) });
    return { secret, otpauthUrl: otpauthUrl(secret, identity.email) };
  }

  async confirmEnrollment(identity: SuperadminIdentity, code: string, request: Request): Promise<SuperadminSession> {
    const key = `superadmin:${identity.userId}`;
    await this.guardAttempts(key);
    const user = await this.load(identity.userId);
    if (user.totpSecret) throw new ConflictException('already_enrolled');
    if (!user.totpPendingSecret) throw new BadRequestException('enrollment_not_started');
    const step = verifyTotp(open(user.totpPendingSecret, this.material()), code, new Date());
    if (step === null) {
      await codeThrottle.fail(key);
      throw new UnauthorizedException('wrong_code');
    }
    await codeThrottle.succeed(key);
    await this.users.update(identity.userId, {
      totpSecret: user.totpPendingSecret,
      totpPendingSecret: null,
      totpLastStep: String(step),
    });
    await this.access.record({ action: 'superadmin.2fa.enrolled', actorId: identity.userId, actorEmail: identity.email, request });
    return this.issue(identity);
  }

  async verify(identity: SuperadminIdentity, code: string, request: Request): Promise<SuperadminSession> {
    const key = `superadmin:${identity.userId}`;
    await this.guardAttempts(key);
    const user = await this.load(identity.userId);
    if (!user.totpSecret) throw new BadRequestException('not_enrolled');
    const lastStep = user.totpLastStep == null ? null : Number(user.totpLastStep);
    const step = verifyTotp(open(user.totpSecret, this.material()), code, new Date(), lastStep);
    if (step === null) {
      await codeThrottle.fail(key);
      await this.access.record({ action: 'superadmin.login.failed', actorId: identity.userId, actorEmail: identity.email, request });
      throw new UnauthorizedException('wrong_code');
    }
    await codeThrottle.succeed(key);
    const material = this.material();
    await this.users.update(identity.userId, {
      totpLastStep: String(step),
      // Sealed before the rename: seal it again with the current key.
      ...(isLegacy(user.totpSecret, material) ? { totpSecret: seal(open(user.totpSecret, material), material) } : {}),
    });
    await this.access.record({ action: 'superadmin.login', actorId: identity.userId, actorEmail: identity.email, request });
    return this.issue(identity);
  }

  async changePassword(identity: SuperadminIdentity, current: string, next: string, request: Request): Promise<void> {
    const key = `superadmin:${identity.userId}`;
    await this.guardAttempts(key);
    if (next.length < MIN_SUPERADMIN_PASSWORD) throw new BadRequestException('password_too_short');
    const user = await this.load(identity.userId);
    if (!user.passwordHash || !(await bcrypt.compare(current, user.passwordHash))) {
      await codeThrottle.fail(key);
      throw new UnauthorizedException('wrong_password');
    }
    await this.users.update(identity.userId, { passwordHash: await bcrypt.hash(next, 12) });
    await this.access.record({ action: 'superadmin.password.changed', actorId: identity.userId, actorEmail: identity.email, request });
  }

  private async issue(identity: SuperadminIdentity): Promise<SuperadminSession> {
    const token = await this.jwt.signAsync(
      { sub: identity.userId },
      { audience: SUPERADMIN_AUDIENCE, expiresIn: SUPERADMIN_SESSION_SECONDS },
    );
    return { token, expiresAt: new Date(Date.now() + SUPERADMIN_SESSION_SECONDS * 1000).toISOString() };
  }
}
