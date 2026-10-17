import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/entities/user.entity.js';
import { SuperadminAccess } from '../auth/superadmin-access.service.js';

export const MIN_SUPERADMIN_PASSWORD = 12;

/**
 * Makes the server's SUPERADMIN_EMAIL the one superadmin, on every boot.
 * Whoever else carries the flag loses it, so the variable stays the only
 * way to name a superadmin: nothing in the API can set it.
 *
 * The first time, the account is created with SUPERADMIN_INITIAL_PASSWORD
 * (to be removed from the server once signed in and changed). A password
 * already set is never overwritten from the variable. SUPERADMIN_RESET_2FA=yes
 * forgets the authenticator app, for a lost phone.
 */
@Injectable()
export class SuperadminBootstrap implements OnApplicationBootstrap {
  private readonly logger = new Logger('Superadmin');

  constructor(
    private readonly config: ConfigService,
    private readonly access: SuperadminAccess,
    @InjectRepository(User) private readonly users: Repository<User>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    const email = this.access.configuredEmail();
    await this.users
      .createQueryBuilder()
      .update()
      .set({ isSuperadmin: false })
      .where('is_superadmin = true AND (email IS NULL OR lower(email) <> :email)', { email: email ?? '' })
      .execute();
    if (!email) return;

    let user = await this.users
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('lower(user.email) = :email', { email })
      .getOne();
    const initial = this.config.get<string>('SUPERADMIN_INITIAL_PASSWORD') ?? '';
    const usableInitial = initial.length >= MIN_SUPERADMIN_PASSWORD ? initial : null;
    if (initial && !usableInitial) {
      this.logger.warn(`SUPERADMIN_INITIAL_PASSWORD is ignored: it needs at least ${MIN_SUPERADMIN_PASSWORD} characters.`);
    }

    if (!user) {
      if (!usableInitial) {
        this.logger.warn('SUPERADMIN_EMAIL names no account yet. Set SUPERADMIN_INITIAL_PASSWORD to create it.');
        return;
      }
      user = await this.users.save(
        this.users.create({ email, firstName: 'Superadmin', passwordHash: await bcrypt.hash(usableInitial, 12) }),
      );
      this.logger.log('Superadmin account created. Remove SUPERADMIN_INITIAL_PASSWORD once signed in.');
    } else if (!user.passwordHash && usableInitial) {
      await this.users.update(user.id, { passwordHash: await bcrypt.hash(usableInitial, 12) });
    }

    await this.users.update(user.id, { isSuperadmin: true });
    if (this.config.get<string>('SUPERADMIN_RESET_2FA') === 'yes') {
      await this.users.update(user.id, { totpSecret: null, totpPendingSecret: null, totpLastStep: null });
      this.logger.warn('Superadmin authenticator forgotten (SUPERADMIN_RESET_2FA=yes). Remove the variable once set up again.');
      await this.access.record({ action: 'superadmin.2fa.reset', actorId: user.id, actorEmail: email });
    }
  }
}
