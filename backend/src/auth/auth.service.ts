import { ConflictException, HttpException, HttpStatus, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service.js';
import { UserPoisService } from '../user-pois/user-pois.service.js';
import { PoisService } from '../pois/pois.service.js';
import { LoginDto } from './dto/login.dto.js';
import { JoinPoiDto } from '../user-pois/dto/join-poi.dto.js';
import type { Language } from '../common/enums/language.enum.js';
import { LoginThrottle } from './login-throttle.js';
import { SuperadminAccess } from './superadmin-access.service.js';
import { CONSENT_VERSION } from '../privacy/consent.js';

// Five wrong passwords for one address in 15 minutes locks it for 15.
const adminLoginThrottle = new LoginThrottle('admin-login', 5, 15 * 60_000, 15 * 60_000);

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly userPoisService: UserPoisService,
    private readonly poisService: PoisService,
    private readonly jwtService: JwtService,
    private readonly superadminAccess: SuperadminAccess,
  ) {}

  async login(dto: LoginDto, request?: Request): Promise<{ accessToken: string }> {
    const key = dto.email.trim().toLowerCase();
    if ((await adminLoginThrottle.lockedFor(key)) > 0) {
      throw new HttpException('Too many attempts. Try again in 15 minutes.', HttpStatus.TOO_MANY_REQUESTS);
    }
    const user = await this.usersService.findByEmailForLogin(dto.email);
    if (!user?.passwordHash || !(await bcrypt.compare(dto.password, user.passwordHash))) {
      await adminLoginThrottle.fail(key);
      await this.superadminAccess.record({
        action: 'admin.login.failed',
        actorEmail: key,
        request,
      });
      throw new UnauthorizedException('Invalid email or password');
    }
    await adminLoginThrottle.succeed(key);
    await this.usersService.markLoggedIn(user.id);
    await this.superadminAccess.record({ action: 'admin.login', actorId: user.id, actorEmail: key, request });
    const accessToken = await this.jwtService.signAsync({ sub: user.id });
    return { accessToken };
  }

  async me(userId: string) {
    const user = await this.usersService.findOne(userId);
    const [adminPois, memberships] = await Promise.all([
      this.userPoisService.findAdminPoisForUser(userId),
      this.userPoisService.findPoisForUser(userId),
    ]);
    return {
      id: user.id,
      email: user.email,
      // Members have a phone or an email (or both); admins an email.
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      // Where the app reopens for someone who belongs to more than one
      // place. Can point at a place they have since left or that has been
      // deleted, so the app treats it as a preference, not a guarantee.
      lastActivePoiId: user.lastActivePoiId,
      language: user.language,
      // The app asks to accept the terms and privacy policy whenever this
      // is true: never accepted, or accepted before the current version.
      consentRequired: user.consentVersion !== CONSENT_VERSION,
      consentVersion: CONSENT_VERSION,
      // Shows the Superadmin menu; every superadmin route checks again.
      isSuperadmin: (await this.superadminAccess.identify(userId)) !== null,
      adminPois,
      // Every place this person belongs to, admin or not — the app's "my
      // places" list, which used to be device-local only.
      pois: memberships.map((membership) => membership.poi),
    };
  }

  /**
   * Re-joining a place you already belong to is not an error worth showing
   * anyone: the app calls this every time a signed-in person opens a place,
   * so the expected outcome is "you're a member", not "you just joined".
   */
  async joinPoi(userId: string, dto: JoinPoiDto) {
    try {
      return await this.userPoisService.join(userId, dto);
    } catch (error) {
      if (error instanceof ConflictException) {
        return this.userPoisService.findMembership(userId, dto.qrCodeToken);
      }
      throw error;
    }
  }

  leavePoi(userId: string, poiId: string): Promise<void> {
    return this.userPoisService.leave(userId, poiId);
  }

  /** The settings menu's name field. Returns the same shape as `me` so the
   * app can drop the answer straight into its session. */
  async updateMyProfile(userId: string, profile: { firstName?: string; lastName?: string }) {
    await this.usersService.updateProfile(userId, profile);
    return this.me(userId);
  }

  /**
   * Remembers where somebody was, every time they open a place. The POI
   * has to exist — a typo'd id would otherwise be stored and then quietly
   * ignored forever — but membership is not checked: the app records this
   * as it enters, and joining is a separate call that may still be in
   * flight.
   */
  async setLastActivePoi(userId: string, poiId: string) {
    await this.poisService.findOne(poiId);
    await this.usersService.updateLastActivePoi(userId, poiId);
    return this.me(userId);
  }

  async updateMyAvatar(userId: string, avatarUrl: string) {
    await this.usersService.updateAvatar(userId, avatarUrl);
    return this.me(userId);
  }

  async updateMyLanguage(userId: string, language: Language): Promise<{ language: Language }> {
    const user = await this.usersService.updateLanguage(userId, language);
    return { language: user.language };
  }
}
